import { NextResponse } from "next/server";
import db from "@/lib/db";

// Queue a Drive backup of this audit's CSV — actually uploading requires the
// Drive MCP connection, which only Claude Code has, so this just queues the
// job like every other piece of real work in this app.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const audit = await db.prepare("SELECT id FROM vis_audits WHERE id = ?").get(id);
  if (!audit) return NextResponse.json({ error: "not found" }, { status: 404 });

  const open = await db
    .prepare(
      `SELECT id FROM vis_jobs
       WHERE type='backup_audit_csv' AND status IN ('pending','running')
         AND (payload::json->>'audit_id')::bigint = ?`
    )
    .get(id);
  if (open) return NextResponse.json({ ok: true, already_queued: true });

  await db.prepare("INSERT INTO vis_jobs (type, payload) VALUES ('backup_audit_csv', ?)").run(
    JSON.stringify({ audit_id: id })
  );
  return NextResponse.json({ ok: true });
}
