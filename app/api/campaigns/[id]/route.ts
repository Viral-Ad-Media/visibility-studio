import { NextResponse } from "next/server";
import db from "@/lib/db";

// Delete a campaign along with its campaign_businesses and any of its jobs.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const campaign = db.prepare("SELECT id FROM campaigns WHERE id = ?").get(id);
  if (!campaign) return NextResponse.json({ error: "not found" }, { status: 404 });

  db.transaction(() => {
    db.prepare("DELETE FROM jobs WHERE json_extract(payload, '$.campaign_id') = ?").run(id);
    db.prepare("DELETE FROM campaign_businesses WHERE campaign_id = ?").run(id);
    db.prepare("DELETE FROM campaigns WHERE id = ?").run(id);
  })();
  return NextResponse.json({ ok: true });
}
