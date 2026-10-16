"use client";

import Link from "next/link";
import { useEffect } from "react";

// Catches render errors below the root layout, so the page keeps the app's
// fonts and theme. Errors in the root layout itself go to global-error.tsx.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-semibold text-slate-100">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm text-slate-400">
        The page hit an unexpected error. Try again, and if it keeps happening,
        let us know.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs font-mono text-slate-500">
          Reference: {error.digest}
        </p>
      )}
      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
        >
          Try again
        </button>
        <Link
          href="/"
          className="border border-ink-700 hover:bg-ink-800 text-slate-200 text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
