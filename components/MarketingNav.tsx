"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radar } from "lucide-react";

const links = [
  { href: "/about", label: "About" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
];

export default function MarketingNav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-ink-700 bg-ink-950/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Radar className="w-5 h-5 text-indigo-400" />
          <span className="font-bold text-slate-100">Visibility Studio</span>
        </Link>
        <nav className="hidden sm:flex items-center gap-6">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm ${
                pathname === l.href
                  ? "text-slate-100 font-medium"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/app"
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Open the app
        </Link>
      </div>
    </header>
  );
}
