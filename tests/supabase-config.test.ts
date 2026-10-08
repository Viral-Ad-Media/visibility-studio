import { it, expect, vi, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { NextRequest } from "next/server";
import {
  getSupabaseConfig,
  SupabaseConfigurationError,
} from "../lib/supabase-config";
import { validateSupabaseConfig } from "../lib/supabase-config-validation.mjs";
import { proxy } from "../proxy";

vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn() }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
function configure() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
}
it("supports current publishable and legacy anon keys with publishable precedence", () => {
  configure();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "legacy-public-key");
  expect(getSupabaseConfig().key).toBe("legacy-public-key");
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    " sb_publishable_fixture ",
  );
  expect(getSupabaseConfig().key).toBe("sb_publishable_fixture");
});
it("identifies missing names and invalid URLs without printing key values", () => {
  expect(() => validateSupabaseConfig("", undefined)).toThrow(
    "NEXT_PUBLIC_SUPABASE_URL",
  );
  expect(() =>
    validateSupabaseConfig("https://example.supabase.co", ""),
  ).toThrow(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );
  expect(() =>
    validateSupabaseConfig("not a url", "sb_publishable_fixture"),
  ).toThrow("Invalid NEXT_PUBLIC_SUPABASE_URL");
});
it("rejects secret and legacy service-role keys in public configuration", () => {
  expect(() =>
    validateSupabaseConfig("https://example.supabase.co", "sb_secret_fixture"),
  ).toThrow(SupabaseConfigurationError);
  const jwt = `header.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64")}.signature`;
  expect(() =>
    validateSupabaseConfig("https://example.supabase.co", jwt),
  ).toThrow("never a secret or service_role key");
});
it("fails closed with an uncached 503 when auth configuration is missing", async () => {
  configure();
  vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await proxy(new NextRequest("https://example.com/app"));
  expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({
    error: "Authentication is temporarily unavailable",
  });
});
it("prevents a deployment build without configuration and permits either public key name", () => {
  const env = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    DATABASE_URL: "postgresql://postgres:fixture@db.example.com:5432/postgres",
  };
  const missing = spawnSync(
    process.execPath,
    ["scripts/check-deploy-env.mjs"],
    { env, encoding: "utf8" },
  );
  expect(missing.status).toBe(1);
  expect(missing.stderr).toContain("Deployment configuration error");
  for (const key of [
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ]) {
    const valid = spawnSync(
      process.execPath,
      ["scripts/check-deploy-env.mjs"],
      { env: { ...env, [key]: "sb_publishable_fixture" }, encoding: "utf8" },
    );
    expect(valid.status).toBe(0);
    expect(valid.stdout).not.toContain("sb_publishable_fixture");
  }
});
