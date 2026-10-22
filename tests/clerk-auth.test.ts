import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
import { NextRequest } from "next/server";
import { afterEach, expect, it, vi } from "vitest";
import {
  AuthConfigurationError,
  resolveAuthProvider,
  validateAuthConfig,
  validateClerkConfig,
} from "../lib/auth-config";
import {
  CLERK_SESSION_COOKIE,
  signClerkSessionToken,
  verifyClerkSessionToken,
} from "../lib/clerk-session";
import { proxy } from "../proxy";

const FIXTURE_HOST = "clerk.example.com";
const FIXTURE_ISSUER = `https://${FIXTURE_HOST}`;
const FIXTURE_PK_LIVE = ["pk", "live", Buffer.from(`${FIXTURE_HOST}$`).toString("base64")].join("_");
const FIXTURE_SK_LIVE = ["sk", "live", "fixture"].join("_");
const FIXTURE_SK_TEST = ["sk", "test", "fixture"].join("_");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it("validates Clerk publishable and secret keys without leaking values", () => {
  const cfg = validateClerkConfig(FIXTURE_PK_LIVE, FIXTURE_SK_LIVE);
  expect(cfg).toEqual({
    provider: "clerk",
    publishableKey: FIXTURE_PK_LIVE,
    secretKey: FIXTURE_SK_LIVE,
    frontendApi: FIXTURE_HOST,
    issuer: FIXTURE_ISSUER,
    environment: "live",
  });

  expect(() => validateClerkConfig("", FIXTURE_SK_LIVE)).toThrow(
    "Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  );
  expect(() => validateClerkConfig(FIXTURE_PK_LIVE, "")).toThrow(
    "Missing CLERK_SECRET_KEY",
  );
  expect(() => validateClerkConfig(FIXTURE_SK_LIVE, FIXTURE_SK_LIVE)).toThrow(
    "never a secret key",
  );
  expect(() => validateClerkConfig(FIXTURE_PK_LIVE, FIXTURE_PK_LIVE)).toThrow(
    "never a publishable key",
  );
  expect(() => validateClerkConfig(FIXTURE_PK_LIVE, FIXTURE_SK_TEST)).toThrow(
    "environment mismatch",
  );
  expect(() =>
    resolveAuthProvider({ VIS_AUTH_PROVIDER: "invalid" }),
  ).toThrow(AuthConfigurationError);
});

it("verifies HS256 and RS256 Clerk session tokens and rejects wrong issuer, expiry or forged signatures", () => {
  const now = 1_760_000_000;
  const token = signClerkSessionToken({
    subject: "user_2abcDEF123456",
    issuer: FIXTURE_ISSUER,
    secretKey: FIXTURE_SK_LIVE,
    sessionId: "sess_123",
    nowSeconds: now,
    expiresInSeconds: 300,
  });

  expect(
    verifyClerkSessionToken(token, {
      issuer: FIXTURE_ISSUER,
      secretKey: FIXTURE_SK_LIVE,
      nowSeconds: now + 60,
    }),
  ).toEqual({
    subject: "user_2abcDEF123456",
    issuer: FIXTURE_ISSUER,
    sessionId: "sess_123",
  });

  // Wrong issuer rejected
  expect(
    verifyClerkSessionToken(token, {
      issuer: "https://clerk.other.example.com",
      secretKey: FIXTURE_SK_LIVE,
      nowSeconds: now + 60,
    }),
  ).toBeNull();

  // Expired token rejected
  expect(
    verifyClerkSessionToken(token, {
      issuer: FIXTURE_ISSUER,
      secretKey: FIXTURE_SK_LIVE,
      nowSeconds: now + 600,
    }),
  ).toBeNull();

  // Forged signature rejected
  expect(
    verifyClerkSessionToken(token, {
      issuer: FIXTURE_ISSUER,
      secretKey: ["sk", "live", "other"].join("_"),
      nowSeconds: now + 60,
    }),
  ).toBeNull();

  // Standard Clerk RS256 JWT verification via JWKS
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const jwk = {
    ...(publicKey.export({ format: "jwk" }) as crypto.JsonWebKey),
    kid: "ins_key_1",
  };
  const rsHeader = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT", kid: "ins_key_1" }),
  ).toString("base64url");
  const rsPayload = Buffer.from(
    JSON.stringify({
      iss: FIXTURE_ISSUER,
      sub: "user_3L3IpxgLzcd57UNcQoMG5oiPbgy",
      sid: "sess_rs256",
      iat: now,
      nbf: now,
      exp: now + 300,
      azp: "https://visibility-studio-tau.vercel.app",
    }),
  ).toString("base64url");
  const rsSig = crypto
    .sign("RSA-SHA256", Buffer.from(`${rsHeader}.${rsPayload}`), privateKey)
    .toString("base64url");
  const rsJwt = `${rsHeader}.${rsPayload}.${rsSig}`;

  expect(
    verifyClerkSessionToken(rsJwt, {
      issuer: FIXTURE_ISSUER,
      secretKey: FIXTURE_SK_LIVE,
      jwksKeys: [jwk],
      authorizedOrigins: ["https://visibility-studio-tau.vercel.app"],
      nowSeconds: now + 10,
    }),
  ).toEqual({
    subject: "user_3L3IpxgLzcd57UNcQoMG5oiPbgy",
    issuer: FIXTURE_ISSUER,
    sessionId: "sess_rs256",
  });

  // Unauthorized azp rejected
  expect(
    verifyClerkSessionToken(rsJwt, {
      issuer: FIXTURE_ISSUER,
      secretKey: FIXTURE_SK_LIVE,
      jwksKeys: [jwk],
      authorizedOrigins: ["https://other.example.com"],
      nowSeconds: now + 10,
    }),
  ).toBeNull();
});

it("enforces Clerk authentication in proxy without falling back to Supabase", async () => {
  vi.stubEnv("VIS_AUTH_PROVIDER", "clerk");
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", FIXTURE_PK_LIVE);
  vi.stubEnv("CLERK_SECRET_KEY", "");
  vi.spyOn(console, "error").mockImplementation(() => {});

  // Missing CLERK_SECRET_KEY fails closed with 503
  const missingCfgRes = await proxy(new NextRequest("https://example.com/app"));
  expect(missingCfgRes.status).toBe(503);
  expect(missingCfgRes.headers.get("cache-control")).toBe("no-store");

  vi.stubEnv("CLERK_SECRET_KEY", FIXTURE_SK_LIVE);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_fixture");

  // Unauthenticated API request returns 401
  const unauthApi = await proxy(
    new NextRequest("https://example.com/api/audits"),
  );
  expect(unauthApi.status).toBe(401);

  // Unauthenticated /app request redirects to /login
  const unauthApp = await proxy(
    new NextRequest("https://example.com/app/campaigns"),
  );
  expect(unauthApp.status).toBe(307);
  expect(unauthApp.headers.get("location")).toBe(
    "https://example.com/login?next=%2Fapp%2Fcampaigns",
  );

  // Authenticated Clerk cookie passes proxy
  const validToken = signClerkSessionToken({
    subject: "user_3L3IpxgLzcd57UNcQoMG5oiPbgy",
    issuer: FIXTURE_ISSUER,
    secretKey: FIXTURE_SK_LIVE,
  });
  const authedReq = new NextRequest("https://example.com/app", {
    headers: { cookie: `${CLERK_SESSION_COOKIE}=${validToken}` },
  });
  const authedRes = await proxy(authedReq);
  expect(authedRes.status).toBe(200);
});

it("validates Clerk deployment environment in check-deploy-env.mjs", () => {
  const res = spawnSync(process.execPath, ["scripts/check-deploy-env.mjs"], {
    env: {
      ...process.env,
      VIS_AUTH_PROVIDER: "clerk",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: FIXTURE_PK_LIVE,
      CLERK_SECRET_KEY: FIXTURE_SK_LIVE,
      DATABASE_URL: "postgresql://postgres:fixture@db.example.com:5432/postgres",
    },
    encoding: "utf8",
  });
  expect(res.status).toBe(0);
  expect(res.stdout).toContain(
    "Clerk Auth and PostgreSQL deployment configuration is present.",
  );
  expect(res.stdout).not.toContain(FIXTURE_SK_LIVE);
});

it("executes the Neon schema and rehearsal checks in PGlite", async () => {
  const pg = new PGlite();
  await pg.exec(readFileSync("neon/001_visibility_schema.sql", "utf8"));
  await pg.exec(readFileSync("neon/002_rehearsal_checks.sql", "utf8"));
  await pg.close();
});
