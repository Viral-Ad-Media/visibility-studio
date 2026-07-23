import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function POST(req: Request) {
  const body = await req.json();
  const category = String(body.category ?? "").trim();
  const location = String(body.location ?? "").trim();
  if (!category || !location) {
    return NextResponse.json({ error: "category and location are required" }, { status: 400 });
  }
  const target = Math.min(Math.max(Number(body.target_count) || 10, 1), 50);
  const query = `${category} in ${location}`;

  const audit = db
    .prepare(
      `INSERT INTO audits (query, category, location, target_count, notes)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(query, category, location, target, body.notes?.trim() || null);

  db.prepare("INSERT INTO jobs (type, payload) VALUES ('run_audit', ?)").run(
    JSON.stringify({ audit_id: audit.lastInsertRowid })
  );

  return NextResponse.json({ id: audit.lastInsertRowid });
}
