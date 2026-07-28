import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { supabaseServerClient } from "@/lib/supabase-server";
import db, { getCurrentAccountId } from "@/lib/db";
import { getCreditBalance } from "@/lib/billing";
import { hasAppAccess, type Account } from "@/lib/shared";
import { BuyAccessButton, BuyCreditsGrid, StartTrialButton } from "@/components/BillingActions";
import { logout } from "@/app/(auth)/actions";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { success?: string; canceled?: string };
}) {
  const {
    data: { user },
  } = await supabaseServerClient().auth.getUser();
  if (!user) redirect("/login");

  const accountId = await getCurrentAccountId();
  const [account, creditBalance] = await Promise.all([
    db
      .prepare("SELECT id, name, access_granted, trial_ends_at FROM vis_accounts WHERE id = ?")
      .get(accountId) as Promise<Account>,
    getCreditBalance(accountId),
  ]);

  const onTrial = hasAppAccess(account) && !account.access_granted;
  const trialEligible = !account.access_granted && !account.trial_ends_at;
  const trialDaysLeft = onTrial
    ? Math.max(0, Math.ceil((new Date(account.trial_ends_at!).getTime() - Date.now()) / 86_400_000))
    : 0;

  return (
    <div className="min-h-screen bg-ink-950 px-4 py-10">
      <main className="mx-auto max-w-lg">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-100">Billing</h1>
          <form action={logout}>
            <button className="text-sm text-slate-400 hover:text-slate-200">Log out</button>
          </form>
        </div>

        {searchParams.success && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            <CheckCircle2 className="h-4 w-4" /> Payment received — this updates within a few
            seconds.
          </div>
        )}
        {searchParams.canceled && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            <XCircle className="h-4 w-4" /> Checkout canceled.
          </div>
        )}

        {!account.access_granted ? (
          <div className="space-y-4">
            {onTrial && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
                <Clock className="h-4 w-4" /> Free trial active — {trialDaysLeft}{" "}
                {trialDaysLeft === 1 ? "day" : "days"} left.{" "}
                <Link href="/app" className="underline">
                  Go to app
                </Link>
              </div>
            )}
            {trialEligible && (
              <div className="card p-5">
                <h2 className="mb-1 text-sm font-semibold text-slate-100">Try it free for 30 days</h2>
                <p className="mb-4 text-sm text-slate-400">
                  Full access to automated audits and campaigns, no payment required. Comes with
                  $20 of starter credit. One trial per account.
                </p>
                <StartTrialButton />
              </div>
            )}
            <div className="card p-5">
              <h2 className="mb-1 text-sm font-semibold text-slate-100">
                {onTrial ? "Unlock permanently" : "Unlock Visibility Studio"}
              </h2>
              <p className="mb-4 text-sm text-slate-400">
                One-time payment for full access to audits, campaigns, and every feature going
                forward.
              </p>
              <BuyAccessButton />
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="card p-5 text-center">
              <div className="text-3xl font-bold text-emerald-400">${creditBalance.toFixed(2)}</div>
              <div className="text-xs text-slate-500">credit balance</div>
            </div>
            <div className="card p-5">
              <h2 className="mb-1 text-sm font-semibold text-slate-100">Buy credits</h2>
              <p className="mb-4 text-sm text-slate-400">
                Credits fund the real Anthropic API cost of running audits and campaigns — each
                job deducts its own actual cost from your balance. New audits/campaigns are
                blocked once your balance reaches $0.
              </p>
              <BuyCreditsGrid />
            </div>
            <Link href="/app" className="block text-center text-sm text-slate-400 hover:text-slate-200">
              Back to app
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
