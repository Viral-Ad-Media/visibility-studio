import { NextResponse } from "next/server";
import db from "@/lib/db";

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

  const row = (await db
    .prepare(
      `SELECT cb.id, cb.business_id, cb.campaign_id, c.audit_id
       FROM vis_campaign_businesses cb JOIN vis_campaigns c ON c.id = cb.campaign_id
       WHERE cb.id = ?`
    )
    .get(id)) as
    | { id: number; business_id: number; campaign_id: number; audit_id: number }
    | undefined;
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const open = await db
    .prepare(
      `SELECT id FROM vis_jobs
       WHERE type=? AND status IN ('pending','running')
         AND (payload::json->>'campaign_business_id')::bigint = ?`
    )
    .get(type, id);
  if (open) return NextResponse.json({ ok: true, already_queued: true });

  const payload = JSON.stringify({
    audit_id: row.audit_id,
    campaign_id: row.campaign_id,
    campaign_business_id: row.id,
    business_id: row.business_id,
  });
  await db.prepare("INSERT INTO vis_jobs (type, payload) VALUES (?, ?)").run(type, payload);

  const statusCol = type === "build_redesign" ? "redesign_status" : "booking_status";
  const errorCol = type === "build_redesign" ? "redesign_error" : "booking_error";
  await db
    .prepare(
      `UPDATE vis_campaign_businesses SET ${statusCol}='pending', ${errorCol}=NULL, updated_at=now()::text WHERE id=?`
    )
    .run(id);

  return NextResponse.json({ ok: true });
}
