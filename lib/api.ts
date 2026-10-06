import { NextResponse } from "next/server";
import { z } from "zod";
import db, { getCurrentAccountId, getRequestAccount } from "./db";
import { hasAppAccess } from "./shared";

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function requireOwner() {
  const context = await getRequestAccount();
  if (!context.accountId || context.role !== "owner")
    throw new ApiError("Only account owners can manage the team", 403);
  return context;
}
export async function parseBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<z.infer<T>> {
  let body: unknown;
  if (Number(req.headers.get("content-length")) > 65536)
    throw new ApiError("Request too large", 413);
  const reader = req.body?.getReader();
  if (!reader) throw new ApiError("Invalid JSON");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) {
        await reader.cancel();
        throw new ApiError("Request too large", 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("Invalid JSON");
  } finally {
    reader.releaseLock();
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new ApiError(
      parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    );
  return parsed.data;
}
export const positiveId = z.number().int().positive().safe();
export const idList = z
  .array(positiveId)
  .min(1)
  .max(100)
  .transform((ids) => Array.from(new Set(ids)));
export const auditInput = z.object({
  category: z.string().trim().min(1).max(200),
  location: z.string().trim().min(1).max(200),
  target_count: z.number().int().min(1).max(50).default(10),
  notes: z.string().trim().max(4000).nullable().optional(),
});
export function parseId(value: string): number {
  const result = positiveId.safeParse(Number(value));
  if (!result.success) throw new ApiError("Invalid ID");
  return result.data;
}
export function apiRoute<T extends unknown[]>(
  handler: (...args: T) => Promise<Response>,
  checkAccess = true,
) {
  return async (...args: T): Promise<Response> => {
    try {
      if (checkAccess) {
        const id = await getCurrentAccountId();
        const account = await db
          .prepare(
            "SELECT access_granted, trial_ends_at FROM vis_accounts WHERE id = ?",
          )
          .get(id);
        if (!hasAppAccess(account as any))
          throw new ApiError("Software access expired — visit Billing", 402);
      }
      return await handler(...args);
    } catch (error) {
      if (error instanceof ApiError)
        return NextResponse.json(
          { error: error.message },
          { status: error.status },
        );
      const message = error instanceof Error ? error.message : "";
      if (
        [
          "insufficient_credits",
          "insufficient_available_credits",
          "access_required",
        ].includes(message)
      )
        return NextResponse.json(
          { error: "Access or available credits required — visit Billing" },
          { status: 402 },
        );
      if (message === "unauthorized")
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      if (message === "queue_limit")
        return NextResponse.json(
          { error: "Queue is full — wait for current work to finish" },
          { status: 429 },
        );
      if ((error as { code?: string })?.code === "23505")
        return NextResponse.json(
          { error: "This action has already been recorded" },
          { status: 409 },
        );
      if (message === "already_queued")
        return NextResponse.json({ ok: true, already_queued: true });
      console.error("API operation failed", {
        type: error instanceof Error ? error.name : "unknown",
      });
      return NextResponse.json(
        { error: "Operation failed. Please try again." },
        { status: 500 },
      );
    }
  };
}
