import Link from "next/link";
import { requestPasswordReset } from "../actions";
import { FormMessage, inputClass as input } from "@/components/ui/field";
import { buttonVariants } from "@/components/ui/button";

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
        <FormMessage tone="success">
          If an account exists for that email, we&apos;ve sent a link to reset
          the password. It works once, in this browser.
        </FormMessage>
      ) : (
        <p className="text-sm text-slate-400">
          Enter your account email and we&apos;ll send you a reset link.
        </p>
      )}
      {searchParams.error && (
        <FormMessage>{searchParams.error}</FormMessage>
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
      <button className={buttonVariants({ size: "lg", className: "w-full" })}>
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
