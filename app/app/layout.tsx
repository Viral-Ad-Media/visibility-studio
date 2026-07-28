import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import db, { getCurrentAccountId } from "@/lib/db";
import { getCreditBalance } from "@/lib/billing";
import { hasAppAccess, type Account } from "@/lib/shared";

// Everything under this layout is auth-gated and per-user — never statically
// cache it (this also fixes /app/new, which has no DB read of its own but
// now sits under a layout that does one).
export const dynamic = "force-dynamic";

export default async function CockpitLayout({ children }: { children: React.ReactNode }) {
  const membership = await db.prepare("SELECT id FROM vis_account_users LIMIT 1").get();
  if (!membership) redirect("/onboarding");

  const accountId = await getCurrentAccountId();
  const account = (await db
    .prepare("SELECT id, name, access_granted, trial_ends_at FROM vis_accounts WHERE id = ?")
    .get(accountId)) as Account;
  if (!hasAppAccess(account)) redirect("/billing");

  const onTrial = !account.access_granted && !!account.trial_ends_at;
  const trialDaysLeft = onTrial
    ? Math.max(0, Math.ceil((new Date(account.trial_ends_at!).getTime() - Date.now()) / 86_400_000))
    : 0;

  const creditBalance = await getCreditBalance(accountId);

  return (
    <div className="flex min-h-screen">
      <Nav creditBalance={creditBalance} onTrial={onTrial} trialDaysLeft={trialDaysLeft} />
      <main className="flex-1 p-8 max-w-6xl mx-auto w-full">{children}</main>
    </div>
  );
}
