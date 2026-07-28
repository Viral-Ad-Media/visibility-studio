import { NextResponse } from "next/server";
import db from "@/lib/db";

// The insert below fires a Postgres trigger (pg_net) that POSTs to
// /api/engine/run instantly — no application-side call needed. See CLAUDE.md
// "The automated engine".
export async function POST(req: Request) {
  const body = await req.json();
  const category = String(body.category ?? "").trim();
  const location = String(body.location ?? "").trim();
  if (!category || !location) {
    return NextResponse.json({ error: "category and location are required" }, { status: 400 });
  }
  const target = Math.min(Math.max(Number(body.target_count) || 10, 1), 50);
  const query = `${category} in ${location}`;

  const audit = await db
    .prepare(
      `INSERT INTO vis_audits (query, category, location, target_count, notes)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(query, category, location, target, body.notes?.trim() || null);

  await db.prepare("INSERT INTO vis_jobs (type, payload) VALUES ('run_audit', ?)").run(
    JSON.stringify({ audit_id: audit.lastInsertRowid })
  );

  return NextResponse.json({ id: audit.lastInsertRowid });
}
