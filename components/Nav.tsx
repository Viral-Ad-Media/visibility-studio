"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, SearchCheck, Radar, Megaphone, Settings, LogOut, History, Wallet, Clock, Users, Send, Gift, ShieldAlert } from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import ProductTour from "./ProductTour";

const links = [
  { href: "/app", label: "Audits", icon: LayoutDashboard, tourId: "tour-nav-audits" },
  { href: "/app/new", label: "New audit", icon: SearchCheck, tourId: "tour-nav-new-audit" },
  { href: "/app/campaigns", label: "Campaigns", icon: Megaphone, tourId: "tour-nav-campaigns" },
  { href: "/app/contacts", label: "Contacts", icon: Users, tourId: "tour-nav-contacts" },
  { href: "/app/emails", label: "Emails", icon: Send, tourId: "tour-nav-emails" },
  { href: "/app/referrals", label: "Referrals", icon: Gift, tourId: "tour-nav-referrals" },
  { href: "/app/audit-trail", label: "Audit trail", icon: History, tourId: "tour-nav-audit-trail" },
  { href: "/app/settings", label: "Settings", icon: Settings, tourId: "tour-nav-settings" },
];

export default function Nav({
  creditBalance,
  onTrial,
  trialDaysLeft,
  isPlatformAdmin,
}: {
  creditBalance: number;
  onTrial: boolean;
  trialDaysLeft: number;
  isPlatformAdmin?: boolean;
}) {
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
      {links.map(({ href, label, icon: Icon, tourId }) => {
        const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            id={tourId}
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
        {isPlatformAdmin && (
          <Link
            href="/admin"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-rose-300 bg-rose-500/10 hover:bg-rose-500/15"
            title="Cross-tenant platform admin dashboard"
          >
            <ShieldAlert className="w-4 h-4 shrink-0" />
            Admin
          </Link>
        )}
        {onTrial && (
          <Link
            href="/billing"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-amber-300 bg-amber-500/10 hover:bg-amber-500/15"
            title="Free trial — click to manage billing"
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span>
              Trial: {trialDaysLeft} {trialDaysLeft === 1 ? "day" : "days"} left
            </span>
          </Link>
        )}
        <Link
          href="/billing"
          id="tour-nav-billing"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-400 bg-ink-800/50 hover:bg-ink-800"
          title="Credit balance funding audit/campaign job cost — click to top up"
        >
          <Wallet className="w-4 h-4 shrink-0" />
          <span>
            Credit balance: <span className="text-slate-200 font-medium">${creditBalance.toFixed(2)}</span>
          </span>
        </Link>
        <form action={logout}>
          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-ink-800 hover:text-slate-200">
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </form>
        <div className="px-3 pb-1 text-[11px] text-slate-600 leading-relaxed">
          Audits and campaigns run automatically — no need to run anything yourself.
        </div>
      </div>
      <ProductTour />
    </nav>
  );
}
