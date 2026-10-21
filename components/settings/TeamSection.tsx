"use client";
import { apiFetch } from "@/lib/client-request";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { inputClass as input } from "@/components/ui/field";

type Member = { user_id: string; email: string; role: string };

export default function TeamSection({
  members,
  currentUserId,
}: {
  members: Member[];
  currentUserId: string;
}) {
  const router = useRouter();
  const isOwner = members.some(
    (m) => m.user_id === currentUserId && m.role === "owner",
  );
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);


  async function addMember(e: React.FormEvent) {
    try {
      e.preventDefault();
      setBusy(true);
      setError(null);
      const res = await apiFetch("/api/team", {
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
      setMessage(body.message);
      setEmail("");
      router.refresh();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Operation failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(userId: string) {
    try {
      setBusy(true);
      setError(null);
      const res = await apiFetch("/api/team", {
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
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Operation failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-6 space-y-3">
        <h2 className="text-sm font-medium text-slate-200">Members</h2>
        <div className="space-y-2">
          {members.map((m) => (
            <div
              key={m.user_id}
              className="flex items-center justify-between text-sm"
            >
              <div>
                <span className="text-slate-200">{m.email}</span>
                <span className="text-slate-600 ml-2 text-xs">{m.role}</span>
                {m.user_id === currentUserId && (
                  <span className="text-slate-600 ml-2 text-xs">(you)</span>
                )}
              </div>
              {isOwner && m.role !== "owner" && (
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

      {message && (
        <p role="status" className="text-sm text-emerald-400">
          {message}
        </p>
      )}
      {isOwner && (
        <form onSubmit={addMember} className="card p-6 space-y-3">
          <div>
            <h2 className="text-base font-semibold text-slate-100 mb-1">
              Invite a member
            </h2>
            <p className="text-xs text-slate-500">
              Ask them to sign in with this email and accept the invitation from
              their account menu.
            </p>
          </div>
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className={input}
              type="email"
              aria-label="Teammate email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@company.com"
              required
            />
            <Button type="submit" disabled={busy} className="shrink-0">
              {busy ? "Inviting…" : "Invite"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
