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

  return (
    <div className="flex min-h-screen">
      <Nav />
      <main className="flex-1 p-8 max-w-6xl mx-auto w-full">{children}</main>
    </div>
  );
}
