import { NextResponse } from "next/server";
import db, { Audit } from "@/lib/db";

// Requeue an audit (e.g. after an error, or to top up businesses).
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const audit = db.prepare("SELECT id FROM audits WHERE id = ?").get(id);
  if (!audit) return NextResponse.json({ error: "not found" }, { status: 404 });

  const open = db
    .prepare(
      `SELECT id FROM jobs
       WHERE type='run_audit' AND status IN ('pending','running')
         AND json_extract(payload, '$.audit_id') = ?`
    )
    .get(id);
  if (open) return NextResponse.json({ ok: true, already_queued: true });

  db.prepare("INSERT INTO jobs (type, payload) VALUES ('run_audit', ?)").run(
    JSON.stringify({ audit_id: id })
  );
  db.prepare("UPDATE audits SET status='queued', updated_at=datetime('now') WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}

// Edit a queued (or errored) audit before the engine picks it up.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const audit = db.prepare("SELECT * FROM audits WHERE id = ?").get(id) as Audit | undefined;
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
  const notes =
    body.notes === undefined ? audit.notes : String(body.notes).trim() || null;

  db.prepare(
    `UPDATE audits SET
       query=?, category=?, location=?, target_count=?, notes=?, updated_at=datetime('now')
     WHERE id=?`
  ).run(`${category} in ${location}`, category, location, target, notes, id);
  return NextResponse.json({ ok: true });
}

// Delete an audit along with its businesses, campaigns, and any of its jobs.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const audit = db.prepare("SELECT id FROM audits WHERE id = ?").get(id);
  if (!audit) return NextResponse.json({ error: "not found" }, { status: 404 });

  db.transaction(() => {
    db.prepare("DELETE FROM jobs WHERE json_extract(payload, '$.audit_id') = ?").run(id);
    db.prepare(
      "DELETE FROM campaign_businesses WHERE campaign_id IN (SELECT id FROM campaigns WHERE audit_id = ?)"
    ).run(id);
    db.prepare("DELETE FROM campaigns WHERE audit_id = ?").run(id);
    db.prepare("DELETE FROM businesses WHERE audit_id = ?").run(id);
    db.prepare("DELETE FROM audits WHERE id = ?").run(id);
  })();
  return NextResponse.json({ ok: true });
}
