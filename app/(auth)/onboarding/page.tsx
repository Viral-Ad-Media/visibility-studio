import Link from "next/link";
import { SearchCheck, Megaphone, Sparkles } from "lucide-react";
import { createAccount } from "../actions";

const input =
  "w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm text-slate-200 " +
  "placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30";

// A lightweight 2-step flow via ?step= rather than client-side state — this
// app is server-rendered-first (no other auth page needs a client
// component), and a plain link between steps is enough for two screens.
export default function OnboardingPage({
  searchParams,
}: {
  searchParams: { error?: string; step?: string; ref?: string };
}) {
  if (searchParams.step === "2") {
    return (
      <form action={createAccount} className="card p-6 space-y-4 animate-fade-in-up">
        <div className="text-[11px] text-slate-600 mb-1">Step 2 of 2</div>
        <h1 className="text-lg font-semibold text-slate-100">Name your account</h1>
        <p className="text-sm text-slate-400">
          This is the workspace your audits and campaigns will live under.
        </p>
        {searchParams.error && <p className="text-sm text-red-400">{searchParams.error}</p>}
        {searchParams.ref && <input type="hidden" name="ref" value={searchParams.ref} />}

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Account name</label>
          <input
            className={input}
            type="text"
            name="name"
            placeholder="e.g. Viral Ad Media"
            required
            autoFocus
          />
        </div>
        <button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
          Create account
        </button>
      </form>
    );
  }

  return (
    <div className="card p-6 space-y-5 animate-fade-in-up">
      <div className="text-[11px] text-slate-600">Step 1 of 2</div>
      <div>
        <h1 className="text-lg font-semibold text-slate-100 mb-1">Welcome to Visibility Studio</h1>
        <p className="text-sm text-slate-400">
          Here&apos;s what happens once your account is set up:
        </p>
      </div>
      <ul className="space-y-3">
        <li className="flex items-start gap-3">
          <div className="flex items-center justify-center rounded-full border border-ink-700 bg-ink-800 p-1.5 shrink-0 mt-0.5">
            <SearchCheck className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-sm text-slate-300">
            <span className="text-slate-100 font-medium">Queue an audit</span> — give it a niche
            and location, and it finds and audits real local businesses automatically. No need to
            run anything yourself.
          </div>
        </li>
        <li className="flex items-start gap-3">
          <div className="flex items-center justify-center rounded-full border border-ink-700 bg-ink-800 p-1.5 shrink-0 mt-0.5">
            <Megaphone className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-sm text-slate-300">
            <span className="text-slate-100 font-medium">Select businesses, create a campaign</span>{" "}
            — get a homepage redesign mockup and a real booking link for each one.
          </div>
        </li>
        <li className="flex items-start gap-3">
          <div className="flex items-center justify-center rounded-full border border-ink-700 bg-ink-800 p-1.5 shrink-0 mt-0.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-sm text-slate-300">
            <span className="text-slate-100 font-medium">Reach out</span> — sending outreach stays
            a manual step; everything up to that point is done for you.
          </div>
        </li>
      </ul>
      <Link
        href={`/onboarding?step=2${searchParams.ref ? `&ref=${encodeURIComponent(searchParams.ref)}` : ""}`}
        className="block w-full text-center bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
      >
        Continue
      </Link>
    </div>
  );
}
