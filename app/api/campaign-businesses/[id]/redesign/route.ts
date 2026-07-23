import db from "@/lib/db";

// Serves the stored mockup HTML directly, unwrapped by any app chrome — this
// is the only place redesign_html gets selected (it can be tens of KB).
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const row = (await db
    .prepare("SELECT redesign_html, redesign_status FROM vis_campaign_businesses WHERE id = ?")
    .get(Number(params.id))) as { redesign_html: string | null; redesign_status: string } | undefined;

  if (!row || !row.redesign_html) {
    return new Response("Redesign mockup not ready yet.", { status: 404 });
  }
  return new Response(row.redesign_html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
