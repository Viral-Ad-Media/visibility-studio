import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import db, {
  getCurrentAccountId,
  getRequestAccount,
  serviceDb,
} from "@/lib/db";
import { getCreditBalance } from "@/lib/billing";
import { hasAppAccess, type Account } from "@/lib/shared";
import { TooltipProvider } from "@/components/ui/tooltip";

// Everything under this layout is auth-gated and per-user — never statically
// cache it (this also fixes /app/new, which has no DB read of its own but
// now sits under a layout that does one).
export const dynamic = "force-dynamic";

export default async function CockpitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await getRequestAccount();
  const membership = await db
    .prepare("SELECT id FROM vis_account_users WHERE user_id = ? LIMIT 1")
    .get(userId);
  if (!membership) redirect("/onboarding");

  const accountId = await getCurrentAccountId();
  const account = (await db
    .prepare(
      "SELECT id, name, access_granted, trial_ends_at, is_platform_admin FROM vis_accounts WHERE id = ?",
    )
    .get(accountId)) as Account & { is_platform_admin: boolean };
  if (!hasAppAccess(account)) redirect("/billing");

  const onTrial = !account.access_granted && !!account.trial_ends_at;
  const trialDaysLeft = onTrial
    ? Math.max(
        0,
        Math.ceil(
          (new Date(account.trial_ends_at!).getTime() - Date.now()) /
            86_400_000,
        ),
      )
    : 0;

  const creditBalance = await getCreditBalance(accountId);
  const admin = await serviceDb
    .prepare("SELECT user_id FROM vis_platform_admins WHERE user_id = ?")
    .get(userId);

  return (
    <TooltipProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-ink-800 focus:px-4 focus:py-2 focus:text-sm focus:text-slate-100"
      >
        Skip to content
      </a>
      <div className="flex flex-col md:flex-row min-h-screen">
        <Nav
          creditBalance={creditBalance}
          onTrial={onTrial}
          trialDaysLeft={trialDaysLeft}
          isPlatformAdmin={!!admin}
        />
        <main
          id="main"
          className="flex-1 min-w-0 px-4 py-6 md:p-8 lg:px-10 max-w-6xl mx-auto w-full"
        >
          {children}
        </main>
      </div>
    </TooltipProvider>
  );
}
