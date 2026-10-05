"use client";
import { apiFetch } from "@/lib/client-request";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ACCESS_FEE_USD, CREDIT_PACKS, formatUsd } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Wallet } from "lucide-react";

async function startCheckout(body: object) {
  const res = await apiFetch("/api/billing/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.url)
    throw new Error("Checkout did not return a URL. Please try again.");
  window.location.href = data.url;
}

export function BuyAccessButton() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      className="w-full"
      size="lg"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await startCheckout({ type: "access" });
        } catch (error) {
          window.alert(
            error instanceof Error ? error.message : "Checkout failed",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Redirecting…" : `Unlock — ${formatUsd(ACCESS_FEE_USD)} one-time`}
    </Button>
  );
}

export function StartTrialButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="w-full">
      <Button
        className="w-full"
        size="lg"
        variant="outline"
        disabled={busy}
        onClick={async () => {
          try {
            setBusy(true);
            setError(null);
            const res = await apiFetch("/api/billing/start-trial", {
              method: "POST",
            });
            setBusy(false);
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              setError(body.error ?? "Couldn't start the trial");
              return;
            }
            router.push("/app");
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
        }}
      >
        {busy ? "Starting…" : "Start free trial"}
      </Button>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function BuyCreditsGrid() {
  const [busy, setBusy] = useState<number | null>(null);
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {CREDIT_PACKS.map((pack) => (
        <Card key={pack.amountUsd} className="text-center">
          <CardHeader className="items-center pb-2">
            <div className="flex items-center justify-center rounded-full border p-2 mb-1">
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </div>
            <Badge variant="secondary" className="rounded-full">
              credit
            </Badge>
          </CardHeader>
          <CardContent className="pt-0">
            <span className="text-2xl font-bold text-foreground">
              {pack.label}
            </span>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              variant="outline"
              disabled={busy !== null}
              onClick={async () => {
                setBusy(pack.amountUsd);
                try {
                  await startCheckout({
                    type: "credits",
                    amountUsd: pack.amountUsd,
                  });
                } catch (error) {
                  window.alert(
                    error instanceof Error ? error.message : "Checkout failed",
                  );
                } finally {
                  setBusy(null);
                }
              }}
            >
              {busy === pack.amountUsd ? "Redirecting…" : "Add"}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
