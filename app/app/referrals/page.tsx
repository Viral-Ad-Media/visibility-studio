import { Gift } from "lucide-react";
import db, { getCurrentAccountId } from "@/lib/db";
import ReferralLinkCard from "@/components/ReferralLinkCard";

export const dynamic = "force-dynamic";

type ReferralRow = {
  id: number;
  status: "pending" | "rewarded";
  reward_usd: number;
  created_at: string;
  rewarded_at: string | null;
  referred_name: string;
};

export default async function ReferralsPage() {
  const accountId = await getCurrentAccountId();

  const account = (await db
    .prepare("SELECT referral_code FROM vis_accounts WHERE id = ?")
    .get(accountId)) as { referral_code: string };

  const referrals = (await db
    .prepare(
      `SELECT r.id, r.status, r.reward_usd, r.created_at, r.rewarded_at, a.name AS referred_name
       FROM vis_referrals r
       JOIN vis_accounts a ON a.id = r.referred_account_id
       WHERE r.referrer_account_id = ?
       ORDER BY r.id DESC`
    )
    .all(accountId)) as ReferralRow[];

  const totalEarned = referrals
    .filter((r) => r.status === "rewarded")
    .reduce((sum, r) => sum + Number(r.reward_usd), 0);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const referralLink = `${siteUrl}/signup?ref=${account.referral_code}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Referrals</h1>
          <p className="text-sm text-slate-500 mt-1">
            Invite someone with your link — you both get $10 in credit once they start their
            trial.
          </p>
        </div>
      </div>

      <ReferralLinkCard link={referralLink} code={account.referral_code} />

      <div className="grid sm:grid-cols-2 gap-3 mt-4 mb-6">
        <div className="card p-4">
          <div className="text-xs text-slate-500">Total earned from referrals</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">${totalEarned.toFixed(2)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-slate-500">People referred</div>
          <div className="text-2xl font-bold text-slate-100 mt-1">{referrals.length}</div>
        </div>
      </div>

      {referrals.length === 0 ? (
        <div className="card p-10 text-center animate-fade-in-up">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-ink-700 bg-ink-800">
            <Gift className="h-5 w-5 text-indigo-400" />
          </div>
          <h2 className="text-sm font-semibold text-slate-100 mb-1.5">No referrals yet</h2>
          <p className="mx-auto max-w-sm text-sm text-slate-400">
            Share your link above — once someone signs up with it and starts their trial,
            you&apos;ll both get $10 in credit automatically.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2">Referred account</th>
                <th className="px-2 py-2">Joined</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-4 py-2 text-right">Reward</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((r) => (
                <tr key={r.id} className="border-b border-ink-800">
                  <td className="px-4 py-2.5 text-slate-200">{r.referred_name}</td>
                  <td className="px-2 py-2.5 text-slate-500 text-xs">{r.created_at.slice(0, 10)}</td>
                  <td className="px-2 py-2.5">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        r.status === "rewarded"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular text-slate-300">
                    {r.status === "rewarded" ? `$${Number(r.reward_usd).toFixed(2)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
