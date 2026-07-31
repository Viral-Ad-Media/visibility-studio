import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldAlert, Users, Rocket, DollarSign, AlertTriangle, Clock } from "lucide-react";
import { supabaseServerClient } from "@/lib/supabase-server";
import db, { getCurrentAccountId, serviceDb } from "@/lib/db";
import { logout } from "@/app/(auth)/actions";

export const dynamic = "force-dynamic";

type Stats = {
  total_accounts: number;
  accounts_with_access: number;
  accounts_on_trial: number;
  jobs_pending: number;
  jobs_running: number;
  jobs_error: number;
  total_credit_balance: number;
  total_estimated_spend: number;
};

type AccountRow = {
  id: number;
  name: string;
  // vis_accounts.created_at/trial_ends_at are real `timestamptz` columns
  // (unlike vis_audits/vis_jobs, which store these as TEXT) — pg's driver
  // returns them as Date objects, not strings.
  created_at: Date;
  access_granted: boolean;
  trial_ends_at: Date | null;
  member_count: number;
  audit_count: number;
  campaign_count: number;
  credit_balance: number;
};

type ErroredJob = {
  id: number;
  type: string;
  attempts: number;
  result: string | null;
  updated_at: string;
  account_name: string;
};

export default async function AdminPage() {
  const {
    data: { user },
  } = await supabaseServerClient().auth.getUser();
  if (!user) redirect("/login");

  const accountId = await getCurrentAccountId();
  const self = (await db
    .prepare("SELECT is_platform_admin FROM vis_accounts WHERE id = ?")
    .get(accountId)) as { is_platform_admin: boolean };
  if (!self?.is_platform_admin) redirect("/app");

  // Cross-tenant reads — serviceDb bypasses RLS on purpose, same trust
  // boundary as the Team feature's auth.users join.
  const [stats, accounts, erroredJobs] = await Promise.all([
    serviceDb
      .prepare(
        `SELECT
          (SELECT count(*) FROM vis_accounts) AS total_accounts,
          (SELECT count(*) FROM vis_accounts WHERE access_granted) AS accounts_with_access,
          (SELECT count(*) FROM vis_accounts WHERE NOT access_granted AND trial_ends_at IS NOT NULL AND trial_ends_at > now()) AS accounts_on_trial,
          (SELECT count(*) FROM vis_jobs WHERE status = 'pending') AS jobs_pending,
          (SELECT count(*) FROM vis_jobs WHERE status = 'running') AS jobs_running,
          (SELECT count(*) FROM vis_jobs WHERE status = 'error') AS jobs_error,
          (SELECT COALESCE(SUM(delta_usd), 0) FROM vis_credits_ledger) AS total_credit_balance,
          (SELECT COALESCE(SUM((result::json->>'estimated_cost_usd')::numeric), 0) FROM vis_jobs WHERE result LIKE '{%') AS total_estimated_spend`
      )
      .get() as Promise<Stats>,
    serviceDb
      .prepare(
        `SELECT a.id, a.name, a.created_at, a.access_granted, a.trial_ends_at,
                (SELECT count(*) FROM vis_account_users au WHERE au.account_id = a.id) AS member_count,
                (SELECT count(*) FROM vis_audits WHERE account_id = a.id) AS audit_count,
                (SELECT count(*) FROM vis_campaigns WHERE account_id = a.id) AS campaign_count,
                (SELECT COALESCE(SUM(delta_usd), 0) FROM vis_credits_ledger WHERE account_id = a.id) AS credit_balance
         FROM vis_accounts a
         ORDER BY a.id DESC`
      )
      .all() as Promise<AccountRow[]>,
    serviceDb
      .prepare(
        `SELECT j.id, j.type, j.attempts, j.result, j.updated_at, a.name AS account_name
         FROM vis_jobs j
         JOIN vis_accounts a ON a.id = j.account_id
         WHERE j.status = 'error'
         ORDER BY j.updated_at DESC
         LIMIT 20`
      )
      .all() as Promise<ErroredJob[]>,
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 text-rose-400" />
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Platform admin</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Cross-tenant view — every account, every job. Not scoped to your own account.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/app" className="text-sm text-slate-400 hover:text-slate-200">
            Back to app
          </Link>
          <form action={logout}>
            <button className="text-sm text-slate-400 hover:text-slate-200">Log out</button>
          </form>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Users} label="Accounts" value={stats.total_accounts} />
        <StatCard
          icon={Rocket}
          label="Access / on trial"
          value={`${stats.accounts_with_access} / ${stats.accounts_on_trial}`}
        />
        <StatCard
          icon={DollarSign}
          label="Credit balance (all)"
          value={`$${Number(stats.total_credit_balance).toFixed(2)}`}
        />
        <StatCard
          icon={DollarSign}
          label="Est. spend (all-time)"
          value={`$${Number(stats.total_estimated_spend).toFixed(2)}`}
        />
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-8">
        <StatCard icon={Clock} label="Jobs pending" value={stats.jobs_pending} tone="amber" />
        <StatCard icon={Clock} label="Jobs running" value={stats.jobs_running} tone="cyan" />
        <StatCard icon={AlertTriangle} label="Jobs errored" value={stats.jobs_error} tone="red" />
      </div>

      <h2 className="text-sm font-semibold text-slate-300 mb-2">Accounts</h2>
      <div className="card overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2">Account</th>
              <th className="px-2 py-2">Created</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2 text-right">Members</th>
              <th className="px-2 py-2 text-right">Audits</th>
              <th className="px-2 py-2 text-right">Campaigns</th>
              <th className="px-4 py-2 text-right">Credit balance</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} className="border-b border-ink-800">
                <td className="px-4 py-2.5 text-slate-200">{a.name}</td>
                <td className="px-2 py-2.5 text-slate-500 text-xs">
                  {new Date(a.created_at).toISOString().slice(0, 10)}
                </td>
                <td className="px-2 py-2.5">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${
                      a.access_granted
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : a.trial_ends_at && new Date(a.trial_ends_at) > new Date()
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        : "bg-slate-500/10 text-slate-400 border-slate-500/30"
                    }`}
                  >
                    {a.access_granted
                      ? "access"
                      : a.trial_ends_at && new Date(a.trial_ends_at) > new Date()
                      ? "trial"
                      : a.trial_ends_at
                      ? "trial expired"
                      : "no access"}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-right tabular text-slate-300">{a.member_count}</td>
                <td className="px-2 py-2.5 text-right tabular text-slate-300">{a.audit_count}</td>
                <td className="px-2 py-2.5 text-right tabular text-slate-300">{a.campaign_count}</td>
                <td className="px-4 py-2.5 text-right tabular text-slate-300">
                  ${Number(a.credit_balance).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-sm font-semibold text-slate-300 mb-2">Recent errored jobs</h2>
      {erroredJobs.length === 0 ? (
        <p className="text-sm text-slate-500">No errored jobs — the queue is healthy.</p>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2">Account</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2 text-right">Attempts</th>
                <th className="px-2 py-2">Error</th>
                <th className="px-4 py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {erroredJobs.map((j) => (
                <tr key={j.id} className="border-b border-ink-800">
                  <td className="px-4 py-2.5 text-slate-200">{j.account_name}</td>
                  <td className="px-2 py-2.5 text-slate-400">{j.type}</td>
                  <td className="px-2 py-2.5 text-right tabular text-slate-300">{j.attempts}</td>
                  <td className="px-2 py-2.5 text-red-400 text-xs max-w-md truncate" title={j.result ?? ""}>
                    {j.result ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs whitespace-nowrap">
                    {j.updated_at.slice(0, 16).replace("T", " ")}
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

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "indigo",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  tone?: "indigo" | "amber" | "cyan" | "red";
}) {
  const toneClass = {
    indigo: "text-indigo-400",
    amber: "text-amber-400",
    cyan: "text-cyan-400",
    red: "text-red-400",
  }[tone];
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Icon className={`w-3.5 h-3.5 ${toneClass}`} />
        {label}
      </div>
      <div className="text-2xl font-bold text-slate-100 mt-1 tabular">{value}</div>
    </div>
  );
}
