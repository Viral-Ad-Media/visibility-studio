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
import { proxy } from "../proxy";
const sdk = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: (handler: any) => (req: any) => handler(async () => ({ userId: sdk.userId }), req),
}));

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

it("requires explicit cutover even when both Clerk keys are staged", () => {
  expect(resolveAuthProvider({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: FIXTURE_PK_LIVE,
    CLERK_SECRET_KEY: FIXTURE_SK_LIVE })).toBe("supabase");
  expect(resolveAuthProvider({ VIS_AUTH_PROVIDER: "clerk" })).toBe("clerk");
});

it("delegates protected requests to Clerk and fails closed for missing configuration", async () => {
  vi.stubEnv("VIS_AUTH_PROVIDER", "clerk");
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", FIXTURE_PK_LIVE);
  vi.stubEnv("CLERK_SECRET_KEY", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
  const event = {} as any;
  expect((await proxy(new NextRequest("https://example.com/app"), event))!.status).toBe(503);
  vi.stubEnv("CLERK_SECRET_KEY", FIXTURE_SK_LIVE);
  sdk.userId = null;
  expect((await proxy(new NextRequest("https://example.com/api/audits"), event))!.status).toBe(401);
  // A legacy custom cookie does not establish an SDK-authenticated identity.
  expect((await proxy(new NextRequest("https://example.com/app", {
    headers: { cookie: "vis_clerk_session=legacy-token" },
  }), event))!.status).toBe(307);
  sdk.userId = "user_verified_by_sdk";
  expect((await proxy(new NextRequest("https://example.com/app"), event))!.status).toBe(200);
  sdk.userId = null;
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
