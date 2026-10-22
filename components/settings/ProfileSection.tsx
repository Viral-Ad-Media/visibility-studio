"use client";

import { useSearchParams } from "next/navigation";
import { changePassword } from "@/app/(auth)/actions";
import PasswordInput from "@/components/PasswordInput";
import { Field, FormMessage, inputClass as input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export default function ProfileSection({ email, clerk = false }: { email: string; clerk?: boolean }) {
  const params = useSearchParams();
  const error = params.get("password_error");
  const changed = params.get("password_changed");

  if (clerk) return <a className="btn" href="/app/security">Manage password and account security</a>;

  return (
    <div className="space-y-4">
      <div className="card p-6 space-y-2">
        <div className="text-xs font-medium text-slate-300">Email</div>
        <div className="text-sm text-slate-200">{email}</div>
      </div>

      <form action={changePassword} className="card p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Change password</h2>
        </div>
        {error && <FormMessage>{error}</FormMessage>}
        {changed && !error && (
          <FormMessage tone="success">Password updated.</FormMessage>
        )}
        <Field label="New password" hint="At least 8 characters.">
          <PasswordInput
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={input}
          />
        </Field>
        <Field label="Confirm new password">
          <PasswordInput
            name="confirm_password"
            required
            minLength={8}
            autoComplete="new-password"
            className={input}
          />
        </Field>
        <Button type="submit">Update password</Button>
      </form>
    </div>
  );
}
