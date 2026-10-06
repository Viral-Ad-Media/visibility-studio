"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-request";
type Account = { id: number; name: string };
export default function AccountMenu() {
  const [data, setData] = useState<{
    accounts: Account[];
    invites: { account_id: number; name: string }[];
    accountId: number;
  }>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    apiFetch("/api/account")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError("Couldn't load account menu"));
  }, []);
  async function select(account_id: number, accept = false) {
    setBusy(true);
    setError("");
    try {
      await apiFetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id, accept }),
      });
      window.location.assign("/app");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Account switch failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2 text-xs px-2">
      {data && data.accounts.length > 0 && (
        <label>
          Account
          <select
            className="w-full p-2 bg-ink-800 rounded"
            aria-label="Active account"
            disabled={busy}
            value={data.accountId}
            onChange={(e) => select(Number(e.target.value))}
          >
            {data.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {data?.invites.map((i) => (
        <button
          className="block p-2 border rounded"
          disabled={busy}
          key={i.account_id}
          onClick={() => select(i.account_id, true)}
        >
          Join {i.name}
        </button>
      ))}
      {error && (
        <p role="alert" className="text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
