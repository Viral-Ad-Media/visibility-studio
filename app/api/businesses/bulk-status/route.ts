import { NextResponse } from "next/server";
import db, { CRM_STATUSES } from "@/lib/db";

export async function PATCH(req: Request) {
  const body = await req.json();
  const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Number.isFinite) : [];
  const status = String(body.crm_status ?? "");
  if (!(CRM_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: "invalid crm_status" }, { status: 400 });
  }
  if (ids.length === 0) {
    return NextResponse.json({ error: "no ids given" }, { status: 400 });
  }
  const info = await db
    .prepare("UPDATE vis_businesses SET crm_status=?, updated_at=now()::text WHERE id = ANY(?)")
    .run(status, ids);
  return NextResponse.json({ ok: true, changed: info.changes });
}
