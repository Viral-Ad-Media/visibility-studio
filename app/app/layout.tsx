import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import db from "@/lib/db";

// Everything under this layout is auth-gated and per-user — never statically
// cache it (this also fixes /app/new, which has no DB read of its own but
// now sits under a layout that does one).
export const dynamic = "force-dynamic";

export default async function CockpitLayout({ children }: { children: React.ReactNode }) {
  const membership = await db.prepare("SELECT id FROM vis_account_users LIMIT 1").get();
  if (!membership) redirect("/onboarding");

  // All-time estimated Anthropic API cost across every job this account has
  // run (audits + campaigns) — mirrors the per-job cost query already used on
  // the audits/campaigns list pages. Filtered to JSON-shaped results only, a
  // job can fail with a plain-string message instead, which would blow up
  // the ::json cast.
  const { cost } = (await db
    .prepare(
      `SELECT SUM(COALESCE((result::json->>'estimated_cost_usd')::numeric, 0)) AS cost
       FROM vis_jobs WHERE result LIKE '{%'`
    )
    .get()) as { cost: string | null };

  return (
    <div className="flex min-h-screen">
      <Nav totalCostUsd={Number(cost) || 0} />
      <main className="flex-1 p-8 max-w-6xl mx-auto w-full">{children}</main>
    </div>
  );
}
