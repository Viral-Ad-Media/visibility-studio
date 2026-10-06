import { it, expect, vi } from "vitest";
import { serviceDb } from "../lib/db";
import { safeLogAuditEvent } from "../lib/auditLog";
it("does not fail completed work when its optional activity log is unavailable", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const prepare = vi
    .spyOn(serviceDb, "prepare")
    .mockReturnValue({
      run: vi.fn().mockRejectedValue(new Error("log unavailable")),
    } as any);
  try {
    await expect(
      safeLogAuditEvent(7, "audit_completed", "Done"),
    ).resolves.toBeUndefined();
  } finally {
    prepare.mockRestore();
    error.mockRestore();
  }
});
