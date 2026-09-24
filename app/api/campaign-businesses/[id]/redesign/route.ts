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
  // The HTML is model-generated from third-party web content (and the column
  // is writable by any tenant member via RLS), so treat it as untrusted:
  // `sandbox` without allow-same-origin gives the page an opaque origin, so
  // even if it carries a script it can't read this app's session cookies or
  // call its API as the viewer. The mockups are static inline-CSS pages by
  // design (see lib/engine/redesign.ts), so nothing legitimate is lost.
  return new Response(row.redesign_html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
