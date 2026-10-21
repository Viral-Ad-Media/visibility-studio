"use client";
import { Button } from "@/components/ui/button";
import AccountMenu from "@/components/AccountMenu";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  SearchCheck,
  Radar,
  Megaphone,
  Settings,
  LogOut,
  History,
  Wallet,
  Clock,
  Users,
  Send,
  Gift,
  ShieldAlert,
  Menu,
  X,
} from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import ProductTour from "./ProductTour";
import ThemeToggle from "./ThemeToggle";

const links = [
  {
    href: "/app",
    label: "Audits",
    icon: LayoutDashboard,
    tourId: "tour-nav-audits",
  },
  {
    href: "/app/new",
    label: "New audit",
    icon: SearchCheck,
    tourId: "tour-nav-new-audit",
  },
  {
    href: "/app/campaigns",
    label: "Campaigns",
    icon: Megaphone,
    tourId: "tour-nav-campaigns",
  },
  {
    href: "/app/contacts",
    label: "Contacts",
    icon: Users,
    tourId: "tour-nav-contacts",
  },
  {
    href: "/app/emails",
    label: "Emails",
    icon: Send,
    tourId: "tour-nav-emails",
  },
  {
    href: "/app/referrals",
    label: "Referrals",
    icon: Gift,
    tourId: "tour-nav-referrals",
  },
  {
    href: "/app/audit-trail",
    label: "Audit trail",
    icon: History,
    tourId: "tour-nav-audit-trail",
  },
  {
    href: "/app/settings",
    label: "Settings",
    icon: Settings,
    tourId: "tour-nav-settings",
  },
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
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="md:hidden sticky top-0 z-30 flex h-14 items-center justify-between border-b border-ink-700 bg-ink-900/95 px-4 backdrop-blur">
        <Link href="/app" className="flex items-center gap-2">
          <Radar className="w-5 h-5 text-indigo-400" />
          <span className="font-bold text-slate-100">Visibility Studio</span>
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-expanded={open}
          aria-controls="cockpit-navigation"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen(!open)}
          className="h-10 w-10 text-slate-300"
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>
      <nav
        id="cockpit-navigation"
        aria-label="App navigation"
        className={`${open ? "flex" : "hidden"} md:flex w-full md:w-60 shrink-0 border-b md:border-b-0 md:border-r border-ink-700 bg-ink-900 p-4 flex-col gap-1 md:sticky md:top-0 md:h-screen md:overflow-y-auto`}
      >
        <Link
          href="/"
          className="hidden md:flex items-center gap-2.5 px-2 py-3 mb-4"
        >
          <Radar className="w-6 h-6 text-indigo-400" />
          <div>
            <div className="font-bold text-slate-100 leading-tight">
              Visibility Studio
            </div>
            <div className="text-xs text-slate-500 leading-tight">
              Prospect audit engine
            </div>
          </div>
        </Link>
        {links.map(({ href, label, icon: Icon, tourId }) => {
          const active =
            href === "/app" ? pathname === "/app" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              id={tourId}
              aria-current={active ? "page" : undefined}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-ink-700 text-slate-100 font-medium"
                  : "text-slate-400 hover:bg-ink-800 hover:text-slate-200"
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${active ? "text-indigo-400" : ""}`}
              />
              {label}
            </Link>
          );
        })}
        <div className="mt-6 md:mt-auto pt-4 space-y-2 border-t border-ink-700">
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
                Trial: {trialDaysLeft} {trialDaysLeft === 1 ? "day" : "days"}{" "}
                left
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
              Credit balance:{" "}
              <span className="text-slate-200 font-medium tabular-nums">
                ${creditBalance.toFixed(2)}
              </span>
            </span>
          </Link>
          <ThemeToggle variant="row" />
          <form action={logout}>
            <Button type="submit" variant="ghost" className="h-auto justify-start w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-ink-800 hover:text-slate-200">
              <LogOut className="w-4 h-4" />
              Log out
            </Button>
          </form>
          <div className="px-3 pb-1 text-xs text-slate-500 leading-relaxed">
            Audits and campaigns run automatically — no need to run anything
            yourself.
          </div>
        </div>
        <AccountMenu />
        <ProductTour />
      </nav>
    </>
  );
}
