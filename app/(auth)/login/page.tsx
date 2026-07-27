import Link from "next/link";
import { login } from "../actions";
import PasswordInput from "@/components/PasswordInput";

const input =
  "w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm text-slate-200 " +
  "placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string; checkEmail?: string };
}) {
  return (
    <form action={login} className="card p-6 space-y-4 animate-fade-in-up">
      <h1 className="text-lg font-semibold text-slate-100">Log in</h1>
      <input type="hidden" name="next" value={searchParams.next ?? "/app"} />

      {searchParams.checkEmail && (
        <p className="text-sm text-emerald-400">Check your email to confirm your account, then log in.</p>
      )}
      {searchParams.error && <p className="text-sm text-red-400">{searchParams.error}</p>}

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
        <input className={input} type="email" name="email" required autoFocus />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
        <PasswordInput className={input} name="password" required />
      </div>
      <button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
        Log in
      </button>
      <p className="text-xs text-slate-500 text-center">
        No account? <Link href="/signup" className="text-indigo-400 hover:underline">Sign up</Link>
      </p>
    </form>
  );
}
