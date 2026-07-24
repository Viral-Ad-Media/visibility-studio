import Link from "next/link";

export default function MarketingFooter() {
  return (
    <footer className="border-t border-ink-700 mt-24">
      <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
        <span>© {new Date().getFullYear()} Visibility Studio. All rights reserved.</span>
        <div className="flex items-center gap-6">
          <Link href="/about" className="hover:text-slate-300">
            About
          </Link>
          <Link href="/pricing" className="hover:text-slate-300">
            Pricing
          </Link>
          <Link href="/faq" className="hover:text-slate-300">
            FAQ
          </Link>
          <Link href="/terms" className="hover:text-slate-300">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
