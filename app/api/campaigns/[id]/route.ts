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
import db, { serviceDb } from "@/lib/db";

// Delete a campaign along with its campaign_businesses and any of its jobs.
async function DELETEHandler(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = parseId((await params).id);
  // Impersonated read = RLS-backed ownership check. vis_jobs is SELECT-only
  // for clients, so the delete runs on serviceDb, scoped to that account_id.
  const campaign = await db
    .prepare("SELECT id, account_id FROM vis_campaigns WHERE id = ?")
    .get(id);
  if (!campaign)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  const accountId = campaign.account_id as number;

  await serviceDb.transaction(async (tx) => {
    await tx
      .prepare(
        "DELETE FROM vis_jobs WHERE account_id = ? AND (payload::json->>'campaign_id')::bigint = ?",
      )
      .run(accountId, id);
    await tx
      .prepare(
        "DELETE FROM vis_campaign_businesses WHERE account_id = ? AND campaign_id = ?",
      )
      .run(accountId, id);
    await tx
      .prepare("DELETE FROM vis_campaigns WHERE account_id = ? AND id = ?")
      .run(accountId, id);
  });
  return NextResponse.json({ ok: true });
}

export const DELETE = apiRoute(DELETEHandler, true);
