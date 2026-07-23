import { NextResponse } from "next/server";
import db from "@/lib/db";

// Create a campaign from a set of businesses within one audit. Queues one
// build_redesign and one create_booking_link job per business.
export async function POST(req: Request) {
  const body = await req.json();
  const auditId = Number(body.audit_id);
  const name = String(body.name ?? "").trim();
  const businessIds: number[] = Array.isArray(body.business_ids)
    ? body.business_ids.map(Number)
    : [];

  if (!auditId || !name) {
    return NextResponse.json({ error: "audit_id and name are required" }, { status: 400 });
  }
  if (businessIds.length === 0) {
    return NextResponse.json({ error: "select at least one business" }, { status: 400 });
  }

  const audit = db.prepare("SELECT id FROM audits WHERE id = ?").get(auditId);
  if (!audit) return NextResponse.json({ error: "audit not found" }, { status: 404 });

  const rows = db
    .prepare(
      `SELECT id FROM businesses WHERE audit_id = ? AND id IN (${businessIds.map(() => "?").join(",")})`
    )
    .all(auditId, ...businessIds) as { id: number }[];
  if (rows.length !== businessIds.length) {
    return NextResponse.json(
      { error: "one or more businesses do not belong to this audit" },
      { status: 400 }
    );
  }

  const campaignId = db.transaction(() => {
    const campaign = db
      .prepare("INSERT INTO campaigns (audit_id, name) VALUES (?, ?)")
      .run(auditId, name);
    const id = campaign.lastInsertRowid as number;

    const insertCb = db.prepare(
      "INSERT INTO campaign_businesses (campaign_id, business_id) VALUES (?, ?)"
    );
    const insertJob = db.prepare("INSERT INTO jobs (type, payload) VALUES (?, ?)");

    for (const businessId of businessIds) {
      const cb = insertCb.run(id, businessId);
      const campaignBusinessId = cb.lastInsertRowid as number;
      const payload = JSON.stringify({
        audit_id: auditId,
        campaign_id: id,
        campaign_business_id: campaignBusinessId,
        business_id: businessId,
      });
      insertJob.run("build_redesign", payload);
      insertJob.run("create_booking_link", payload);
    }
    return id;
  })();

  return NextResponse.json({ id: campaignId });
}
