"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, SearchCheck, Radar, Megaphone, Settings, LogOut, Gauge, History } from "lucide-react";
import { logout } from "@/app/(auth)/actions";

const links = [
  { href: "/app", label: "Audits", icon: LayoutDashboard },
  { href: "/app/new", label: "New audit", icon: SearchCheck },
  { href: "/app/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/app/audit-trail", label: "Audit trail", icon: History },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export default function Nav({ totalCostUsd }: { totalCostUsd: number }) {
  const pathname = usePathname();
  return (
    <nav className="w-56 shrink-0 border-r border-ink-700 bg-ink-900 p-4 flex flex-col gap-1">
      <Link href="/" className="flex items-center gap-2 px-2 py-3 mb-4">
        <Radar className="w-6 h-6 text-indigo-400" />
        <div>
          <div className="font-bold text-slate-100 leading-tight">Visibility Studio</div>
          <div className="text-[11px] text-slate-500 leading-tight">prospect audit engine</div>
        </div>
      </Link>
      {links.map(({ href, label, icon: Icon }) => {
        const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm ${
              active
                ? "bg-ink-700 text-slate-100 font-medium"
                : "text-slate-400 hover:bg-ink-800 hover:text-slate-200"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        );
      })}
      <div className="mt-auto space-y-3">
        <div
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-400 bg-ink-800/50"
          title="Estimated Anthropic API cost across all audits and campaigns run by this account"
        >
          <Gauge className="w-4 h-4 shrink-0" />
          <span>
            Resource usage: <span className="text-slate-200 font-medium">${totalCostUsd.toFixed(2)}</span>
          </span>
        </div>
        <form action={logout}>
          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-ink-800 hover:text-slate-200">
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </form>
        <div className="px-3 pb-1 text-[11px] text-slate-600 leading-relaxed">
          Audits run automatically. Campaigns still need{" "}
          <code className="text-indigo-500">/run-campaigns</code> in Claude Code.
        </div>
      </div>
    </nav>
  );
}
