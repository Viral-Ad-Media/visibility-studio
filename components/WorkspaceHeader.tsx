import Link from "next/link";
import { Search, Wallet } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

export default function WorkspaceHeader({ name, creditBalance }: { name: string; creditBalance: number }) {
  return <header className="border-b border-ink-700 bg-ink-900 px-4 py-3 md:px-8 flex flex-wrap items-center justify-between gap-3">
    <form action="/app/audits" method="get" role="search" className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 w-full sm:w-auto sm:min-w-72">
      <Search size={15} className="text-slate-500" />
      <input name="q" aria-label="Search workspace audits" placeholder="Search audits, niches, locations…" maxLength={200} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      <button className="text-xs text-indigo-400">Search</button>
    </form>
    <div className="flex items-center gap-3 text-sm"><Link href="/billing" className="inline-flex items-center gap-2 rounded-full border border-ink-700 px-3 py-1.5 text-indigo-400"><Wallet size={14} />${creditBalance.toFixed(2)}<span className="sr-only"> available credits</span></Link><ThemeToggle /><span className="hidden lg:block max-w-44 truncate text-slate-400" title={name}>{name}</span></div>
  </header>;
}
