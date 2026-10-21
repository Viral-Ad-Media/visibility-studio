import Link from "next/link";
import { SearchCheck, Megaphone, Sparkles } from "lucide-react";
import { createAccount } from "../actions";
import { Field, FormMessage, inputClass as input } from "@/components/ui/field";
import { buttonVariants } from "@/components/ui/button";

// A lightweight 2-step flow via ?step= rather than client-side state — this
// app is server-rendered-first (no other auth page needs a client
// component), and a plain link between steps is enough for two screens.
export default async function OnboardingPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ error?: string; step?: string; ref?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  if (searchParams.step === "2") {
    return (
      <form
        action={createAccount}
        className="card p-6 space-y-4"
      >
        <div className="text-xs text-slate-500 mb-1">Step 2 of 2</div>
        <h1 className="text-lg font-semibold text-slate-100">
          Name your account
        </h1>
        <p className="text-sm text-slate-400">
          This is the workspace your audits and campaigns will live under.
        </p>
        {searchParams.error && (
          <FormMessage>{searchParams.error}</FormMessage>
        )}
        {searchParams.ref && (
          <input type="hidden" name="ref" value={searchParams.ref} />
        )}

        <Field label="Account name">
          <input
            className={input}
            type="text"
            name="name"
            placeholder="e.g. Viral Ad Media"
            required
            autoFocus
          />
        </Field>
        <button className={buttonVariants({ size: "lg", className: "w-full" })}>
          Create account
        </button>
      </form>
    );
  }

  return (
    <div className="card p-6 space-y-5">
      <div className="text-xs text-slate-500">Step 1 of 2</div>
      <div>
        <h1 className="text-lg font-semibold text-slate-100 mb-1">
          Welcome to Visibility Studio
        </h1>
        <p className="text-sm text-slate-400">
          Here&apos;s what happens once your account is set up:
        </p>
      </div>
      <ul className="space-y-3">
        <li className="flex items-start gap-3">
          <div className="flex items-center justify-center rounded-full border border-ink-700 bg-ink-800 p-1.5 shrink-0 mt-0.5">
            <SearchCheck className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-sm text-slate-300">
            <span className="text-slate-100 font-medium">Queue an audit</span> —
            give it a niche and location, and it finds and audits real local
            businesses automatically. No need to run anything yourself.
          </div>
        </li>
        <li className="flex items-start gap-3">
          <div className="flex items-center justify-center rounded-full border border-ink-700 bg-ink-800 p-1.5 shrink-0 mt-0.5">
            <Megaphone className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-sm text-slate-300">
            <span className="text-slate-100 font-medium">
              Select businesses, create a campaign
            </span>{" "}
            — get a homepage redesign mockup and a real booking link for each
            one.
          </div>
        </li>
        <li className="flex items-start gap-3">
          <div className="flex items-center justify-center rounded-full border border-ink-700 bg-ink-800 p-1.5 shrink-0 mt-0.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-sm text-slate-300">
            <span className="text-slate-100 font-medium">Reach out</span> —
            sending outreach stays a manual step; everything up to that point is
            done for you.
          </div>
        </li>
      </ul>
      <Link
        href={`/onboarding?step=2${searchParams.ref ? `&ref=${encodeURIComponent(searchParams.ref)}` : ""}`}
        className={buttonVariants({ size: "lg", className: "w-full" })}
      >
        Continue
      </Link>
    </div>
  );
}
