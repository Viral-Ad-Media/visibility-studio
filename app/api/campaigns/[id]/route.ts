import { NextResponse } from "next/server";
import db from "@/lib/db";

// Delete a campaign along with its campaign_businesses and any of its jobs.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const campaign = await db.prepare("SELECT id FROM vis_campaigns WHERE id = ?").get(id);
  if (!campaign) return NextResponse.json({ error: "not found" }, { status: 404 });

  await db.transaction(async (tx) => {
    await tx
      .prepare("DELETE FROM vis_jobs WHERE (payload::json->>'campaign_id')::bigint = ?")
      .run(id);
    await tx.prepare("DELETE FROM vis_campaign_businesses WHERE campaign_id = ?").run(id);
    await tx.prepare("DELETE FROM vis_campaigns WHERE id = ?").run(id);
  });
  return NextResponse.json({ ok: true });
}
