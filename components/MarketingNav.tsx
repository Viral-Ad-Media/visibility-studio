"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radar } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

const links = [
  { href: "/about", label: "About" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
];

export default function MarketingNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="border-b border-ink-700 bg-ink-950/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Radar className="w-5 h-5 text-indigo-400" />
          <span className="font-bold text-slate-100">Visibility Studio</span>
        </Link>
        <nav aria-label="Main navigation" className="hidden sm:flex items-center gap-6">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname === l.href ? "page" : undefined}
              className={`text-sm transition-colors ${
                pathname === l.href
                  ? "text-slate-100 font-medium"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/app">Open the app</Link>
          </Button>
          <Button type="button" variant="ghost" className="sm:hidden h-11" aria-expanded={open} aria-controls="marketing-mobile-nav" onClick={() => setOpen((value) => !value)}>
            {open ? "Close" : "Menu"}
          </Button>
        </div>
      </div>
      <nav id="marketing-mobile-nav" aria-label="Mobile navigation" className={`${open ? "flex" : "hidden"} sm:hidden flex-col gap-1 border-t border-ink-700 p-4`}>
        {links.map((link) => (
          <Button key={link.href} asChild variant="ghost" className="h-11 justify-start">
            <Link href={link.href} aria-current={pathname === link.href ? "page" : undefined} onClick={() => setOpen(false)}>{link.label}</Link>
          </Button>
        ))}
        <Button asChild className="h-11">
          <Link href="/app" onClick={() => setOpen(false)}>Open the app</Link>
        </Button>
      </nav>
    </header>
  );
}
