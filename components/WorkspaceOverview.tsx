import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, SearchCheck, Users, Megaphone, Send, AlertCircle } from "lucide-react";

export type WorkspaceSummary = {
  audits: number; businesses: number; high_priority: number; contacts: number;
  drafts: number; campaigns: number; active_audits: number; failed_audits: number;
  selected: number; sent: number; replied: number; booked: number; won: number;
};
export type RecentAudit = { id: number; query: string; location: string; status: string };
export default function WorkspaceOverview({ name, summary: s, recent }: { name: string; summary: WorkspaceSummary; recent: RecentAudit[] }) {
  const steps = [
    { title: "Discover your first prospects", detail: "Choose a niche and location to find and score local businesses.", done: s.audits > 0, href: "/app/new", action: "Start an audit" },
    { title: "Review the opportunities", detail: "Use audit findings and public contacts to decide who to pursue.", done: s.businesses > 0, href: "/app/audits", action: "Review audits" },
    { title: "Build a campaign", detail: "Select prospects to generate redesign concepts and booking links.", done: s.campaigns > 0, href: "/app/campaigns", action: "View campaigns" },
    { title: "Track your outreach", detail: "Send from your own inbox, then update each prospect's stage.", done: s.sent + s.replied + s.booked + s.won > 0, href: "/app/emails", action: "Review drafts" },
  ];
  const completed = steps.filter(step => step.done).length;
  const groups = [
    { title: "Discovery", stats: [{ label: "Audits", value: s.audits, href: "/app/audits", icon: SearchCheck }, { label: "Businesses", value: s.businesses, href: "/app/contacts", icon: Users }] },
    { title: "Opportunity", stats: [{ label: "High priority", value: s.high_priority, href: "/app/audits", icon: SearchCheck }, { label: "Public emails", value: s.contacts, href: "/app/contacts", icon: Users }] },
    { title: "Outreach", stats: [{ label: "Campaigns", value: s.campaigns, href: "/app/campaigns", icon: Megaphone }, { label: "Outreach drafts", value: s.drafts, href: "/app/emails", icon: Send }] },
  ];
  return <div className="space-y-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-medium uppercase tracking-widest text-indigo-400 mb-2">Workspace overview</p><h1 className="text-3xl font-bold tracking-tight text-slate-100">{name}</h1><p className="mt-2 text-sm text-slate-400">Your opportunities, your next steps, and the work that needs you.</p></div>
      <Link href="/app/new" className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"><SearchCheck size={16} /> New audit</Link>
    </div>
    {completed < 4 && <section className="card p-5 md:p-6" aria-labelledby="setup-heading">
      <div className="flex justify-between gap-4"><div><h2 id="setup-heading" className="font-semibold text-slate-100">Build your prospecting workflow</h2><p className="mt-1 text-sm text-slate-400">{completed} of 4 steps complete. Take your first discovery through to outreach.</p></div><span className="text-sm text-indigo-400">{completed}/4</span></div>
      <div role="progressbar" aria-label="Workspace setup" aria-valuemin={0} aria-valuemax={4} aria-valuenow={completed} className="h-1.5 rounded-full bg-ink-800 my-5"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${completed * 25}%` }} /></div>
      <ol className="space-y-3">{steps.map(step => <li key={step.title} className={`flex items-start gap-3 rounded-lg p-3 ${step.done ? "" : "bg-ink-800/50"}`}>
        {step.done ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-400" /> : <Circle size={18} className="mt-0.5 shrink-0 text-slate-500" />}
        <div className="flex-1"><p className={`text-sm font-medium ${step.done ? "text-slate-500" : "text-slate-100"}`}>{step.title}{step.done && <span className="sr-only"> — complete</span>}</p>{!step.done && <p className="mt-1 text-xs text-slate-400">{step.detail}</p>}</div>
        {!step.done && <Link href={step.href} className="shrink-0 text-xs text-indigo-400 hover:underline">{step.action}<ArrowRight size={14} className="inline ml-1" /></Link>}
      </li>)}</ol>
    </section>}
    <section className="card p-4 flex flex-wrap items-center gap-3" aria-label="Needs attention">
      <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400"><AlertCircle size={16} /> Needs attention</span>
      {s.failed_audits > 0 && <Link className="rounded-full bg-red-500/10 px-3 py-1.5 text-xs text-red-400" href="/app/audits?status=error">{s.failed_audits} failed audits →</Link>}
      {s.active_audits > 0 && <Link className="rounded-full bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-400" href="/app/audits?status=active">{s.active_audits} audits in progress →</Link>}
      {s.selected > 0 && <Link className="rounded-full bg-ink-800 px-3 py-1.5 text-xs text-slate-300" href="/app/campaigns">{s.selected} prospects selected for outreach →</Link>}
      {s.failed_audits + s.active_audits + s.selected === 0 && <span className="text-sm text-slate-400">Nothing waiting here. Start a new audit or review your campaigns.</span>}
    </section>
    <div className="grid gap-5 lg:grid-cols-3">{groups.map(group => <section key={group.title}><h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-slate-500">{group.title}</h2><div className="grid grid-cols-2 gap-3">{group.stats.map(({ label, value, href, icon: Icon }) => <Link key={label} href={href} className="card p-4 hover:border-indigo-500/50"><p className="flex items-center gap-2 text-xs text-slate-400"><Icon size={15} className="text-indigo-400" />{label}</p><p className="mt-3 text-3xl font-semibold tabular-nums text-slate-100">{Number(value).toLocaleString()}</p></Link>)}</div></section>)}</div>
    <section className="card p-5 md:p-6"><div className="flex justify-between items-center mb-5"><h2 className="font-semibold text-slate-100">Campaign pipeline</h2><Link href="/app/campaigns" className="text-xs text-indigo-400">View campaigns →</Link></div><div className="grid grid-cols-2 sm:grid-cols-5 gap-3">{([['Selected',s.selected],['Sent',s.sent],['Replied',s.replied],['Booked',s.booked],['Won',s.won]] as const).map(([label,value]) => <div key={label} className="rounded-lg bg-ink-800/50 p-4"><p className="text-xs text-slate-400">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-100">{Number(value).toLocaleString()}</p></div>)}</div><p className="mt-4 text-xs text-slate-500">Current prospect stages across your campaigns. Outreach delivery stays in your own inbox.</p></section>
    <section><div className="flex justify-between items-center mb-3"><h2 className="font-semibold text-slate-100">Recent audits</h2><Link href="/app/audits" className="text-xs text-indigo-400">View all →</Link></div><div className="card divide-y divide-ink-700">{recent.length ? recent.map(audit => <Link key={audit.id} href={`/app/audit/${audit.id}`} className="flex items-center gap-4 p-4 hover:bg-ink-800/40"><div className="flex-1 min-w-0"><p className="truncate text-sm font-medium text-slate-100">{audit.query}</p><p className="mt-1 text-xs text-slate-500">{audit.location}</p></div><span className="rounded-full bg-ink-800 px-3 py-1 text-xs text-slate-300">{audit.status}</span><ArrowRight size={15} className="text-slate-500" /></Link>) : <div className="p-6 text-sm text-slate-400">Your first audit will appear here. Choose a niche and location to get started.</div>}</div></section>
  </div>;
}
