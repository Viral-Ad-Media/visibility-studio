import Link from "next/link";
import { signup } from "../actions";
import PasswordInput from "@/components/PasswordInput";

const input =
  "w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm text-slate-200 " +
  "placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30";

export default function SignupPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <form action={signup} className="card p-6 space-y-4 animate-fade-in-up">
      <h1 className="text-lg font-semibold text-slate-100">Create your account</h1>
      {searchParams.error && <p className="text-sm text-red-400">{searchParams.error}</p>}

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
        <input className={input} type="email" name="email" required autoFocus />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
        <PasswordInput className={input} name="password" required minLength={6} />
      </div>
      <button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
        Sign up
      </button>
      <p className="text-xs text-slate-500 text-center">
        Already have an account? <Link href="/login" className="text-indigo-400 hover:underline">Log in</Link>
      </p>
    </form>
  );
}
