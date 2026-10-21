import Link from "next/link";
import { signup } from "../actions";
import PasswordInput from "@/components/PasswordInput";
import { Field, FormMessage, inputClass as input } from "@/components/ui/field";
import { buttonVariants } from "@/components/ui/button";

export default async function SignupPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ error?: string; ref?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  return (
    <form action={signup} className="card p-6 space-y-4">
      <h1 className="text-lg font-semibold text-slate-100">
        Create your account
      </h1>
      {searchParams.error && (
        <FormMessage>{searchParams.error}</FormMessage>
      )}
      {searchParams.ref && (
        <input type="hidden" name="ref" value={searchParams.ref} />
      )}

      <Field label="Email">
        <input
          className={input}
          type="email"
          name="email"
          autoComplete="email"
          required
          autoFocus
        />
      </Field>
      <Field label="Password" hint="At least 6 characters.">
        <PasswordInput
          className={input}
          name="password"
          autoComplete="new-password"
          required
          minLength={6}
        />
      </Field>
      <button className={buttonVariants({ size: "lg", className: "w-full" })}>
        Sign up
      </button>
      <p className="text-xs text-slate-500 text-center">
        Already have an account?{" "}
        <Link href="/login" className="text-indigo-400 hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
