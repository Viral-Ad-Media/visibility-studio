import { it, expect, vi, afterEach } from "vitest";
import { apiFetch } from "../lib/client-request";
import { idList, auditInput, parseBody, parseId } from "../lib/api";
afterEach(() => vi.unstubAllGlobals());
it("rejects failed HTTP and network mutations", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: "Not enough credits" }), {
          status: 402,
        }),
      ),
  );
  await expect(apiFetch("/api/audits")).rejects.toThrow("Not enough credits");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  await expect(apiFetch("/api/audits")).rejects.toThrow("offline");
});
it("keeps successful response bodies readable", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ id: 3 })));
  expect(await (await apiFetch("/api/audits")).json()).toEqual({ id: 3 });
});
it("bounds IDs, batches and audit inputs without coercing malformed types", async () => {
  expect(() => parseId("NaN")).toThrow("Invalid ID");
  expect(() => parseId("9007199254740992")).toThrow("Invalid ID");
  expect(idList.parse([1, 1, 2])).toEqual([1, 2]);
  expect(idList.safeParse(Array(101).fill(1)).success).toBe(false);
  expect(
    auditInput.safeParse({ category: "", location: "x", target_count: "50" })
      .success,
  ).toBe(false);
  await expect(
    parseBody(
      new Request("https://example.com", { method: "POST", body: "{broken" }),
      auditInput,
    ),
  ).rejects.toThrow("Invalid JSON");
});
