import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ pg: null as any }));
vi.mock("../lib/db", () => ({
  serviceDb: {
    prepare: (sql: string) => ({
      get: async () => (await state.pg.query(sql)).rows[0],
    }),
  },
}));
vi.mock("next/server", () => ({ after: vi.fn() }));
import { engineWakesNeeded, wakeEngine } from "../lib/engine/dispatch";

const fetchMock = vi.fn();
beforeEach(async () => {
  state.pg ??= new PGlite();
  await state.pg.exec(`DROP TABLE IF EXISTS vis_jobs;
    CREATE TABLE vis_jobs(id serial, status text, attempts int, updated_at text)`);
  fetchMock.mockReset().mockResolvedValue(new Response("{}"));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
afterAll(async () => { await state.pg?.close(); });

async function jobs(rows: [string, number, string][]) {
  for (const [status, attempts, age] of rows) {
    await state.pg.query(
      `INSERT INTO vis_jobs(status, attempts, updated_at) VALUES($1, $2, (now() - $3::interval)::text)`,
      [status, attempts, age],
    );
  }
}

it("wakes nothing when no job is claimable", async () => {
  await jobs([["done", 1, "0 minutes"], ["pending", 5, "0 minutes"], ["running", 1, "1 minute"]]);
  expect(await engineWakesNeeded()).toBe(0);
});

it("tops concurrency up to three instead of multiplying", async () => {
  await jobs(Array.from({ length: 10 }, () => ["pending", 0, "0 minutes"] as [string, number, string]));
  expect(await engineWakesNeeded()).toBe(3);
  await jobs([["running", 1, "1 minute"], ["running", 1, "2 minutes"]]);
  expect(await engineWakesNeeded()).toBe(1);
});

it("counts stale running jobs as claimable", async () => {
  await jobs([["running", 2, "10 minutes"]]);
  expect(await engineWakesNeeded()).toBe(1);
});

it("posts the engine secret to the configured site, capped at three calls", async () => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://studio.example.com");
  vi.stubEnv("ENGINE_WEBHOOK_SECRET", "s".repeat(32));
  await wakeEngine(10);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("https://studio.example.com/api/engine/run");
  expect(init.headers["x-engine-secret"]).toBe("s".repeat(32));
});

it("skips the wake-up without a secret", async () => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://studio.example.com");
  vi.stubEnv("ENGINE_WEBHOOK_SECRET", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
  await wakeEngine(1);
  expect(fetchMock).not.toHaveBeenCalled();
});
