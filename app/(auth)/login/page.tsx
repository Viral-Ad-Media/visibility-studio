import { SignIn } from "@clerk/nextjs";
import { resolveAuthProvider } from "@/lib/auth-config";
import Link from "next/link";
import { login } from "../actions";
import PasswordInput from "@/components/PasswordInput";
import { Field, FormMessage, inputClass as input } from "@/components/ui/field";
import { buttonVariants } from "@/components/ui/button";

export default async function LoginPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ error?: string; next?: string; checkEmail?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  if (resolveAuthProvider() === "clerk") {
    const raw = searchParams.next ?? "/app";
    const destination = raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\") ? raw : "/app";
    return <SignIn routing="hash" signUpUrl="/signup" fallbackRedirectUrl={destination} />;
  }
  return (
    <form action={login} className="card p-6 space-y-4">
      <h1 className="text-lg font-semibold text-slate-100">Log in</h1>
      <input type="hidden" name="next" value={searchParams.next ?? "/app"} />

      {searchParams.checkEmail && (
        <FormMessage tone="success">
          Check your email to confirm your account, then log in.
        </FormMessage>
      )}
      {searchParams.error && (
        <FormMessage>{searchParams.error}</FormMessage>
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
      <div>
        <Field label="Password">
          <PasswordInput
            className={input}
            name="password"
            autoComplete="current-password"
            required
          />
        </Field>
        <Link
          href="/forgot-password"
          className="mt-1.5 inline-block text-xs text-indigo-400 hover:underline"
        >
          Forgot password?
        </Link>
      </div>
      <button className={buttonVariants({ size: "lg", className: "w-full" })}>
        Log in
      </button>
      <p className="text-xs text-slate-500 text-center">
        No account?{" "}
        <Link href="/signup" className="text-indigo-400 hover:underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}
