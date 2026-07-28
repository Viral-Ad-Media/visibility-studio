"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Member = { user_id: string; email: string; role: string };

export default function TeamSection({
  members,
  currentUserId,
}: {
  members: Member[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const input =
    "w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm text-slate-200 " +
    "placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 " +
    "focus:ring-2 focus:ring-indigo-500/30";

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Couldn't add that member");
      return;
    }
    setEmail("");
    router.refresh();
  }

  async function removeMember(userId: string) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/team", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Couldn't remove that member");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="card p-6 space-y-3">
        <h2 className="text-sm font-medium text-slate-200">Members</h2>
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center justify-between text-sm">
              <div>
                <span className="text-slate-200">{m.email}</span>
                <span className="text-slate-600 ml-2 text-xs">{m.role}</span>
                {m.user_id === currentUserId && (
                  <span className="text-slate-600 ml-2 text-xs">(you)</span>
                )}
              </div>
              {members.length > 1 && (
                <button
                  onClick={() => removeMember(m.user_id)}
                  disabled={busy}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={addMember} className="card p-6 space-y-3">
        <div>
          <h2 className="text-sm font-medium text-slate-200 mb-1">Add a member</h2>
          <p className="text-[11px] text-slate-600">
            They need an existing Visibility Studio account — sending an invite email to someone
            who hasn&apos;t signed up yet isn&apos;t supported.
          </p>
        </div>
        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <input
            className={input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@company.com"
            required
          />
          <button
            disabled={busy}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg shrink-0"
          >
            Add
          </button>
        </div>
      </form>
    </div>
  );
}
