import { NextResponse } from "next/server";
import db, { getCurrentAccountId } from "@/lib/db";
import { getCreditBalance } from "@/lib/billing";

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

  const audit = await db.prepare("SELECT id FROM vis_audits WHERE id = ?").get(auditId);
  if (!audit) return NextResponse.json({ error: "audit not found" }, { status: 404 });

  // Credits fund the real Anthropic API cost of building redesigns/booking
  // links — refuse to queue new campaign work once the account's balance is
  // spent, same rule as audits (app/api/audits/route.ts).
  const accountId = await getCurrentAccountId();
  const balance = await getCreditBalance(accountId);
  if (balance <= 0) {
    return NextResponse.json(
      { error: "Your credit balance is $0 — add credits in Billing before creating a new campaign." },
      { status: 402 }
    );
  }

  const rows = (await db
    .prepare(
      `SELECT id FROM vis_businesses WHERE audit_id = ? AND id IN (${businessIds.map(() => "?").join(",")})`
    )
    .all(auditId, ...businessIds)) as { id: number }[];
  if (rows.length !== businessIds.length) {
    return NextResponse.json(
      { error: "one or more businesses do not belong to this audit" },
      { status: 400 }
    );
  }

  const campaignId = await db.transaction(async (tx) => {
    const campaign = await tx
      .prepare("INSERT INTO vis_campaigns (audit_id, name) VALUES (?, ?)")
      .run(auditId, name);
    const id = campaign.lastInsertRowid as number;

    const insertCb = tx.prepare(
      "INSERT INTO vis_campaign_businesses (campaign_id, business_id) VALUES (?, ?)"
    );
    const insertJob = tx.prepare("INSERT INTO vis_jobs (type, payload) VALUES (?, ?)");

    for (const businessId of businessIds) {
      const cb = await insertCb.run(id, businessId);
      const campaignBusinessId = cb.lastInsertRowid as number;
      const payload = JSON.stringify({
        audit_id: auditId,
        campaign_id: id,
        campaign_business_id: campaignBusinessId,
        business_id: businessId,
      });
      await insertJob.run("build_redesign", payload);
      await insertJob.run("create_booking_link", payload);
    }
    return id;
  });

  return NextResponse.json({ id: campaignId });
}
