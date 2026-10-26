import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { runWorkerLoop } from "@/lib/engine/worker";
import {
  engineWakesNeeded,
  wakeEngineAfterResponse,
} from "@/lib/engine/dispatch";

export const dynamic = "force-dynamic";
// A single business audit is 2 sequential Claude calls with web_search/
// web_fetch tool loops — observed taking up to ~3 minutes for one business.
// 60s (this route's original value, copied from clickbank-studio's single-
// Claude-call stages) isn't enough and was confirmed timing out in
// production. Requires a Vercel plan that allows >60s function duration.
export const maxDuration = 300;

// Woken by the app itself (lib/engine/dispatch.ts): after a route queues
// jobs, and by this route after each run while claimable work remains, so a
// multi-business audit drains as a chain of invocations. A daily Vercel cron
// (GET, vercel.json) is the backstop for a job whose invocation died with
// nothing else queued behind it. Not called by any client-facing code —
// protected by a shared secret, same fail-closed shape as a webhook
// signature check. See CLAUDE.md "The automated engine".
export async function POST(req: Request) {
  const secret = req.headers.get("x-engine-secret");
  if (!secret || !secretMatches(secret, process.env.ENGINE_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return drain();
}

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when that variable
// is set on the project; without it the backstop stays disabled.
export async function GET(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !secretMatches(token, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return drain();
}

async function drain() {
  try {
    const result = await runWorkerLoop();
    const wakes = await engineWakesNeeded();
    if (wakes > 0) wakeEngineAfterResponse(wakes);
    return NextResponse.json({ ok: true, ...result, wakes });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// Constant-time compare, so the secret can't be recovered byte-by-byte from
// response timing.
function secretMatches(given: string, expected: string | undefined): boolean {
  if (!expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
