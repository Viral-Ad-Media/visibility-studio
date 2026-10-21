import { redirect } from "next/navigation";
import { resetPassword } from "../actions";
import { supabaseServerClient } from "@/lib/supabase-server";
import PasswordInput from "@/components/PasswordInput";

const input =
  "w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm text-slate-200 " +
  "placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30";

// Reached from /auth/confirm once a reset link has been exchanged for a
// session. Outside /app, so the proxy doesn't gate it: check the session here.
export default async function ResetPasswordPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const {
    data: { user },
  } = await (await supabaseServerClient()).auth.getUser();
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
        <p className="text-sm text-red-400">{searchParams.error}</p>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">
          New password
        </label>
        <PasswordInput
          className={input}
          name="password"
          minLength={8}
          autoComplete="new-password"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">
          Confirm new password
        </label>
        <PasswordInput
          className={input}
          name="confirm_password"
          minLength={8}
          autoComplete="new-password"
          required
        />
      </div>
      <button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
        Save password
      </button>
    </form>
  );
}
