import { redirect } from "next/navigation";
import { resetPassword } from "../actions";
import { getAuthenticatedUser } from "@/lib/auth";
import PasswordInput from "@/components/PasswordInput";
import { Field, FormMessage, inputClass as input } from "@/components/ui/field";
import { buttonVariants } from "@/components/ui/button";

// Reached from /auth/confirm once a reset link has been exchanged for a
// session. Outside /app, so the proxy doesn't gate it: check the session here.
export default async function ResetPasswordPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(
      "/forgot-password?error=" +
        encodeURIComponent("That reset link has expired. Request a new one."),
    );
  }

  return (
    <form action={resetPassword} className="card p-6 space-y-4">
      <h1 className="text-lg font-semibold text-slate-100">
        Choose a new password
      </h1>
      <p className="text-sm text-slate-400">For {user.email}</p>
      {searchParams.error && (
        <FormMessage>{searchParams.error}</FormMessage>
      )}

      <Field label="New password" hint="At least 8 characters.">
        <PasswordInput
          className={input}
          name="password"
          minLength={8}
          autoComplete="new-password"
          required
        />
      </Field>
      <Field label="Confirm new password">
        <PasswordInput
          className={input}
          name="confirm_password"
          minLength={8}
          autoComplete="new-password"
          required
        />
      </Field>
      <button className={buttonVariants({ size: "lg", className: "w-full" })}>
        Save password
      </button>
    </form>
  );
}
