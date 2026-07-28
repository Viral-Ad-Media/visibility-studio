"use client";

import { useSearchParams } from "next/navigation";
import { changePassword } from "@/app/(auth)/actions";
import PasswordInput from "@/components/PasswordInput";

export default function ProfileSection({ email }: { email: string }) {
  const params = useSearchParams();
  const error = params.get("password_error");
  const changed = params.get("password_changed");

  const input =
    "w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm text-slate-200 " +
    "placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 " +
    "focus:ring-2 focus:ring-indigo-500/30";

  return (
    <div className="space-y-4">
      <div className="card p-6 space-y-2">
        <label className="block text-xs font-medium text-slate-400">Email</label>
        <div className="text-sm text-slate-200">{email}</div>
      </div>

      <form action={changePassword} className="card p-6 space-y-4">
        <div>
          <h2 className="text-sm font-medium text-slate-200 mb-1">Change password</h2>
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-3">
              {error}
            </p>
          )}
          {changed && !error && (
            <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 mb-3">
              Password updated.
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">New password</label>
          <PasswordInput name="password" required minLength={8} className={input} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Confirm new password</label>
          <PasswordInput name="confirm_password" required minLength={8} className={input} />
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2 rounded-lg">
          Update password
        </button>
      </form>
    </div>
  );
}
