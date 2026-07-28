import { NextResponse } from "next/server";
import db, { Audit } from "@/lib/db";

// Requeue an audit (e.g. after an error, or to top up businesses). The
// insert below fires a Postgres trigger (pg_net) that POSTs to
// /api/engine/run instantly — no application-side call needed.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const audit = await db.prepare("SELECT id FROM vis_audits WHERE id = ?").get(id);
  if (!audit) return NextResponse.json({ error: "not found" }, { status: 404 });

  const open = await db
    .prepare(
      `SELECT id FROM vis_jobs
       WHERE type='run_audit' AND status IN ('pending','running')
         AND (payload::json->>'audit_id')::bigint = ?`
    )
    .get(id);
  if (open) return NextResponse.json({ ok: true, already_queued: true });

  await db.prepare("INSERT INTO vis_jobs (type, payload) VALUES ('run_audit', ?)").run(
    JSON.stringify({ audit_id: id })
  );
  await db
    .prepare("UPDATE vis_audits SET status='queued', updated_at=now()::text WHERE id = ?")
    .run(id);

  return NextResponse.json({ ok: true });
}

// Edit a queued (or errored) audit before the engine picks it up.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const audit = (await db.prepare("SELECT * FROM vis_audits WHERE id = ?").get(id)) as
    | Audit
    | undefined;
  if (!audit) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (audit.status === "running") {
    return NextResponse.json(
      { error: "audit is running — wait for the engine to finish first" },
      { status: 409 }
    );
  }

  const body = await req.json();
  const category = String(body.category ?? audit.category).trim();
  const location = String(body.location ?? audit.location).trim();
  if (!category || !location) {
    return NextResponse.json({ error: "category and location are required" }, { status: 400 });
  }
  const target = Math.min(Math.max(Number(body.target_count) || audit.target_count, 1), 50);
  const notes = body.notes === undefined ? audit.notes : String(body.notes).trim() || null;

  await db
    .prepare(
      `UPDATE vis_audits SET
         query=?, category=?, location=?, target_count=?, notes=?, updated_at=now()::text
       WHERE id=?`
    )
    .run(`${category} in ${location}`, category, location, target, notes, id);
  return NextResponse.json({ ok: true });
}

// Delete an audit along with its businesses, campaigns, and any of its jobs.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const audit = await db.prepare("SELECT id FROM vis_audits WHERE id = ?").get(id);
  if (!audit) return NextResponse.json({ error: "not found" }, { status: 404 });

  await db.transaction(async (tx) => {
    await tx
      .prepare("DELETE FROM vis_jobs WHERE (payload::json->>'audit_id')::bigint = ?")
      .run(id);
    await tx
      .prepare(
        "DELETE FROM vis_campaign_businesses WHERE campaign_id IN (SELECT id FROM vis_campaigns WHERE audit_id = ?)"
      )
      .run(id);
    await tx.prepare("DELETE FROM vis_campaigns WHERE audit_id = ?").run(id);
    await tx.prepare("DELETE FROM vis_businesses WHERE audit_id = ?").run(id);
    await tx.prepare("DELETE FROM vis_audits WHERE id = ?").run(id);
  });
  return NextResponse.json({ ok: true });
}
