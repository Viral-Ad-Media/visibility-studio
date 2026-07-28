import db from "@/lib/db";

export const dynamic = "force-dynamic";

type LogRow = {
  id: number;
  actor_email: string | null;
  action: string;
  description: string;
  cost_usd: string | null;
  created_at: string;
};

export default async function AuditTrailPage() {
  const entries = (await db
    .prepare(
      `SELECT id, actor_email, action, description, cost_usd, created_at
       FROM vis_audit_log
       ORDER BY created_at DESC
       LIMIT 200`
    )
    .all()) as LogRow[];

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 mb-2">Audit trail</h1>
        <p className="text-sm text-slate-400">
          Account activity — team changes, security events, integration connections, and the
          estimated Anthropic API cost of any work that incurred one.
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="card p-6 text-sm text-slate-500">
          No activity recorded yet. Team, security, integration, audit, and campaign events will
          show up here going forward.
        </div>
      ) : (
        <div className="card divide-y divide-ink-700">
          {entries.map((e) => {
            const cost = Number(e.cost_usd);
            return (
              <div key={e.id} className="px-6 py-4 flex items-start justify-between gap-4 text-sm">
                <span className="text-slate-300">{e.description}</span>
                <div className="flex items-center gap-3 shrink-0">
                  {!!cost && (
                    <span
                      className="text-indigo-400 font-mono text-xs"
                      title="Estimated Anthropic API cost"
                    >
                      ~${cost.toFixed(2)}
                    </span>
                  )}
                  <span className="text-slate-600 text-xs whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
