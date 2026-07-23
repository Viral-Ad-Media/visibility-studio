import { NextResponse } from "next/server";
import db, { CAMPAIGN_STAGES } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const body = await req.json();
  const stage = String(body.stage ?? "");
  if (!(CAMPAIGN_STAGES as readonly string[]).includes(stage)) {
    return NextResponse.json({ error: "invalid stage" }, { status: 400 });
  }
  const info = db
    .prepare("UPDATE campaign_businesses SET stage=?, updated_at=datetime('now') WHERE id=?")
    .run(stage, id);
  if (info.changes === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
