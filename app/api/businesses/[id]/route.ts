import { z } from "zod";
import {
  apiRoute,
  parseBody,
  parseId,
  auditInput,
  positiveId,
  idList,
} from "@/lib/api";
import { NextResponse } from "next/server";
import db, { CRM_STATUSES } from "@/lib/db";

async function PATCHHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = parseId((await params).id);
  const body = await parseBody(
    req,
    z.object({ crm_status: z.enum(CRM_STATUSES) }),
  );
  const status = String(body.crm_status ?? "");
  if (!(CRM_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: "invalid crm_status" }, { status: 400 });
  }
  const info = await db
    .prepare(
      "UPDATE vis_businesses SET crm_status=?, updated_at=now()::text WHERE id=?",
    )
    .run(status, id);
  if (info.changes === 0)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export const PATCH = apiRoute(PATCHHandler, true);
