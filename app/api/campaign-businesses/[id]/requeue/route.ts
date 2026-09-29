import { NextResponse } from "next/server";
import db from "@/lib/db";
import { enqueueJob, isInsufficientCredits } from "@/lib/jobs";

const TYPES = ["build_redesign", "create_booking_link"] as const;

// Requeue just one job type for a campaign business (redesign and booking are
// independent failure domains — don't force-regenerate a good mockup just
// because the booking-link call failed, or vice versa).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const body = await req.json();
  const type = String(body.type ?? "");
  if (!(TYPES as readonly string[]).includes(type)) {
    return NextResponse.json(
      { error: "type must be build_redesign or create_booking_link" },
      { status: 400 }
    );
  }

  const row = await db.prepare("SELECT id FROM vis_campaign_businesses WHERE id = ?").get(id);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const open = await db
    .prepare(
      `SELECT id FROM vis_jobs
       WHERE type=? AND status IN ('pending','running')
         AND (payload::json->>'campaign_business_id')::bigint = ?`
    )
    .get(type, id);
  if (open) return NextResponse.json({ ok: true, already_queued: true });

  // The RPC also resets this row's redesign_/booking_ status+error to pending
  // (those columns are engine-owned and not client-writable).
  try {
    await enqueueJob(db, type as "build_redesign" | "create_booking_link", id);
  } catch (err) {
    if (isInsufficientCredits(err)) {
      return NextResponse.json(
        { error: "Your credit balance is $0 — add credits in Billing before retrying." },
        { status: 402 }
      );
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}
