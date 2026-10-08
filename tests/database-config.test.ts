import { it, expect, vi, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { validateDatabaseUrl } from "../lib/database-config-validation.mjs";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

it("rejects missing and invalid database configuration without leaking credentials", () => {
  for (const value of [undefined, "", "  ", "https://secret@db.example.com", "postgresql:///postgres", "password-not-a-url"]) {
    expect(() => validateDatabaseUrl(value)).toThrow(/DATABASE_URL/);
    try { validateDatabaseUrl(value); } catch (error) {
      expect(String(error)).not.toContain("password-not-a-url");
      expect(String(error)).not.toContain("secret@");
    }
  }
  expect(validateDatabaseUrl(" postgresql://postgres:fixture@db.example.com:6543/postgres ")).toBe("postgresql://postgres:fixture@db.example.com:6543/postgres");
});

it("does not construct a pg pool or attempt localhost queries when DATABASE_URL is missing", async () => {
  const constructor = vi.fn();
  vi.doMock("pg", () => ({ Pool: constructor, types: { setTypeParser: vi.fn() } }));
  vi.stubEnv("DATABASE_URL", "");
  const { serviceDb } = await import("../lib/db");
  expect(constructor).not.toHaveBeenCalled();
  await expect(serviceDb.prepare("SELECT 1").get()).rejects.toThrow("Missing DATABASE_URL");
  expect(constructor).not.toHaveBeenCalled();
  vi.doUnmock("pg");
});

it("blocks deployment when Auth is configured but PostgreSQL is absent", () => {
  const result = spawnSync(process.execPath, ["scripts/check-deploy-env.mjs"], {
    env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture", DATABASE_URL: "" },
    encoding: "utf8",
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("Missing DATABASE_URL");
});
