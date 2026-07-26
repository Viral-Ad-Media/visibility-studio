import { createAccount } from "../actions";

const input =
  "w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm text-slate-200 " +
  "placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30";

export default function OnboardingPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <form action={createAccount} className="card p-6 space-y-4 animate-fade-in-up">
      <h1 className="text-lg font-semibold text-slate-100">Name your account</h1>
      <p className="text-sm text-slate-400">
        This is the workspace your audits and campaigns will live under.
      </p>
      {searchParams.error && <p className="text-sm text-red-400">{searchParams.error}</p>}

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
