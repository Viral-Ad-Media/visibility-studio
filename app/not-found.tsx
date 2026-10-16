import Link from "next/link";
import { Radar } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <Radar className="w-6 h-6 text-indigo-400" />
        <span className="font-bold text-slate-100">Visibility Studio</span>
      </Link>
      <p className="text-sm font-mono text-indigo-400">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-100">
        This page doesn&apos;t exist
      </h1>
      <p className="mt-2 text-sm text-slate-400">
        The link may be old, or the address may have a typo.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/"
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
        >
          Go home
        </Link>
        <Link
          href="/app"
          className="border border-ink-700 hover:bg-ink-800 text-slate-200 text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
        >
          Open the app
        </Link>
      </div>
    </div>
  );
}
