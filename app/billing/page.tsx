import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, Clock, ShieldCheck, Rocket } from "lucide-react";
import { supabaseServerClient } from "@/lib/supabase-server";
import db, { getCurrentAccountId } from "@/lib/db";
import { getCreditBalance } from "@/lib/billing";
import { hasAppAccess, type Account } from "@/lib/shared";
import { BuyAccessButton, BuyCreditsGrid, StartTrialButton } from "@/components/BillingActions";
import { logout } from "@/app/(auth)/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

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
    <div className="min-h-screen bg-background px-4 py-10">
      <main className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Billing</h1>
          <form action={logout}>
            <button className="text-sm text-muted-foreground hover:text-foreground">Log out</button>
          </form>
        </div>

        {searchParams.success && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            <CheckCircle2 className="h-4 w-4" /> Payment received — this updates within a few
            seconds.
          </div>
        )}
        {searchParams.canceled && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-red-300">
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
            <div className="grid gap-4 sm:grid-cols-2">
              {trialEligible && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center rounded-full border p-1.5">
                        <Clock className="h-3.5 w-3.5" />
                      </div>
                      <CardTitle className="font-mono text-sm text-muted-foreground">Trial</CardTitle>
                      <Badge variant="secondary" className="ml-auto rounded-full">
                        30 days
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-3xl font-bold">Free</span>
                    </div>
                    <CardDescription className="pt-2">
                      Full access to automated audits and campaigns, no payment required. Comes
                      with $20 of starter credit. One trial per account.
                    </CardDescription>
                  </CardHeader>
                  <CardFooter>
                    <StartTrialButton />
                  </CardFooter>
                </Card>
              )}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center rounded-full border p-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" />
                    </div>
                    <CardTitle className="font-mono text-sm text-muted-foreground">
                      {onTrial ? "Unlock permanently" : "Unlock"}
                    </CardTitle>
                    <Badge variant="secondary" className="ml-auto rounded-full">
                      one-time
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-bold">$97</span>
                  </div>
                  <CardDescription className="pt-2">
                    One-time payment for full access to audits, campaigns, and every feature
                    going forward.
                  </CardDescription>
                </CardHeader>
                <CardFooter>
                  <BuyAccessButton />
                </CardFooter>
              </Card>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="flex items-center justify-center gap-2">
                  <Rocket className="h-4 w-4 text-emerald-400" />
                  <span className="text-3xl font-bold text-emerald-400">
                    ${creditBalance.toFixed(2)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">credit balance</div>
              </CardContent>
            </Card>
            <div>
              <h2 className="mb-1 text-sm font-semibold text-foreground">Buy credits</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Credits fund the real Anthropic API cost of running audits and campaigns — each
                job deducts its own actual cost from your balance. New audits/campaigns are
                blocked once your balance reaches $0.
              </p>
              <BuyCreditsGrid />
            </div>
            <Link
              href="/app"
              className="block text-center text-sm text-muted-foreground hover:text-foreground"
            >
              Back to app
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
