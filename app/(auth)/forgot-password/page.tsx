import Link from "next/link";
import { requestPasswordReset } from "../actions";

const input =
  "w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm text-slate-200 " +
  "placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30";

export default async function ForgotPasswordPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  return (
    <form
      action={requestPasswordReset}
      className="card p-6 space-y-4"
    >
      <h1 className="text-lg font-semibold text-slate-100">
        Reset your password
      </h1>

      {searchParams.sent ? (
        <p className="text-sm text-emerald-400">
          If an account exists for that email, we&apos;ve sent a link to reset
          the password. It works once, in this browser.
        </p>
      ) : (
        <p className="text-sm text-slate-400">
          Enter your account email and we&apos;ll send you a reset link.
        </p>
      )}
      {searchParams.error && (
        <p className="text-sm text-red-400">{searchParams.error}</p>
      )}

      <div>
        <label
          htmlFor="email"
          className="block text-xs font-medium text-slate-400 mb-1.5"
        >
          Email
        </label>
        <input
          id="email"
          className={input}
          type="email"
          name="email"
          autoComplete="email"
          required
          autoFocus
        />
      </div>
      <button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
        Send reset link
      </button>
      <p className="text-xs text-slate-500 text-center">
        Remembered it?{" "}
        <Link href="/login" className="text-indigo-400 hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
