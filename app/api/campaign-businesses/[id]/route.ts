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
import db, { CAMPAIGN_STAGES } from "@/lib/db";

async function PATCHHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = parseId((await params).id);
  const body = await parseBody(
    req,
    z.object({ stage: z.enum(CAMPAIGN_STAGES) }),
  );
  const stage = String(body.stage ?? "");
  if (!(CAMPAIGN_STAGES as readonly string[]).includes(stage)) {
    return NextResponse.json({ error: "invalid stage" }, { status: 400 });
  }
  const info = await db
    .prepare(
      "UPDATE vis_campaign_businesses SET stage=?, updated_at=now()::text WHERE id=?",
    )
    .run(stage, id);
  if (info.changes === 0)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export const PATCH = apiRoute(PATCHHandler, true);
