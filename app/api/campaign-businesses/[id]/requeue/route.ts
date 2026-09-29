import { NextResponse } from "next/server";
import db from "@/lib/db";
import { enqueueCampaignJob, enqueueErrorResponse } from "@/lib/enqueue";

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

  // The RPC checks ownership, already-queued and credit balance in Postgres,
  // builds the job payload itself, and resets the engine-owned
  // redesign_*/booking_* status columns (clients can't write those).
  try {
    const result = await enqueueCampaignJob(db, id, type as (typeof TYPES)[number]);
    if (result.already_queued) return NextResponse.json({ ok: true, already_queued: true });
  } catch (err) {
    const res = enqueueErrorResponse(
      err,
      "Your credit balance is $0 — add credits in Billing before re-running this."
    );
    if (res) return res;
    throw err;
  }

  return NextResponse.json({ ok: true });
}
