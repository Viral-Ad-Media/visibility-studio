"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Member = { user_id: string; email: string; role: string };
type SentInvitation = { id: number; email: string };
type MyInvitation = { id: number; invited_by_email: string | null; account_name: string };

export default function TeamSection({
  members,
  sentInvitations,
  myInvitations,
  currentUserId,
  currentRole,
}: {
  members: Member[];
  sentInvitations: SentInvitation[];
  myInvitations: MyInvitation[];
  currentUserId: string;
  currentRole: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOwner = currentRole === "owner";

  const input =
    "w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm text-slate-200 " +
    "placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 " +
    "focus:ring-2 focus:ring-indigo-500/30";

  async function send(url: string, method: string, body: unknown, fallback: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const parsed = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(parsed.error ?? fallback);
      return false;
    }
    router.refresh();
    return true;
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (await send("/api/team", "POST", { email }, "Couldn't send that invitation")) {
      setEmail("");
    }
  }

  return (
    <div className="space-y-4">
      {myInvitations.length > 0 && (
        <div className="card p-6 space-y-3">
          <div>
            <h2 className="text-sm font-medium text-slate-200 mb-1">Invitations for you</h2>
            <p className="text-[11px] text-slate-600">
              Joining a team gives it access to work you create there. Decline if you don&apos;t
              recognize the sender.
            </p>
          </div>
          <div className="space-y-2">
            {myInvitations.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <span className="text-slate-200">{i.account_name}</span>
                  {i.invited_by_email && (
                    <span className="text-slate-600 ml-2 text-xs">from {i.invited_by_email}</span>
                  )}
                </div>
                <div className="flex gap-3 shrink-0">
                  <button
                    onClick={() =>
                      send(
                        "/api/team/invitations",
                        "POST",
                        { invitation_id: i.id, accept: true },
                        "Couldn't accept that invitation"
                      )
                    }
                    disabled={busy}
                    className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() =>
                      send(
                        "/api/team/invitations",
                        "POST",
                        { invitation_id: i.id, accept: false },
                        "Couldn't decline that invitation"
                      )
                    }
                    disabled={busy}
                    className="text-xs text-slate-400 hover:text-slate-200 disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

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
              {isOwner && m.role !== "owner" && (
                <button
                  onClick={() =>
                    send("/api/team", "DELETE", { user_id: m.user_id }, "Couldn't remove that member")
                  }
                  disabled={busy}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        {sentInvitations.length > 0 && (
          <div className="space-y-2 border-t border-ink-700 pt-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-600">Pending invitations</p>
            {sentInvitations.map((i) => (
              <div key={i.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-slate-400">{i.email}</span>
                  <span className="text-slate-600 ml-2 text-xs">awaiting their response</span>
                </div>
                {isOwner && (
                  <button
                    onClick={() =>
                      send(
                        "/api/team/invitations",
                        "DELETE",
                        { invitation_id: i.id },
                        "Couldn't revoke that invitation"
                      )
                    }
                    disabled={busy}
                    className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {isOwner ? (
        <form onSubmit={invite} className="card p-6 space-y-3">
          <div>
            <h2 className="text-sm font-medium text-slate-200 mb-1">Invite a member</h2>
            <p className="text-[11px] text-slate-600">
              They join only after accepting from their own Settings → Team. If they haven&apos;t
              signed up yet, the invitation waits until they do.
            </p>
          </div>
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
              Invite
            </button>
          </div>
        </form>
      ) : (
        <div className="card p-6">
          <p className="text-xs text-slate-500">
            Only an owner can invite or remove members.
          </p>
        </div>
      )}
    </div>
  );
}
