import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { serviceDb as db } from "@/lib/db";
import { logAuditEvent } from "@/lib/auditLog";

export const dynamic = "force-dynamic";

// Stripe webhook — the ONLY place that grants access or adds credits.
// Verifies the Stripe signature (never trust an unsigned request), then
// writes via serviceDb since this runs with no browser session (RLS would
// otherwise block it — and there's no session to impersonate anyway).
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) {
    return NextResponse.json({ error: "missing signature/secret" }, { status: 400 });
  }

  const rawBody = await req.text();
  const stripe = getStripe();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    return NextResponse.json({ error: `invalid signature: ${err}` }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  const session = event.data.object as {
    id: string;
    amount_total: number | null;
    metadata: Record<string, string> | null;
  };
  const accountId = Number(session.metadata?.account_id);
  const type = session.metadata?.type;
  if (!accountId || (type !== "access" && type !== "credits")) {
    return NextResponse.json({ error: "missing metadata" }, { status: 400 });
  }

  // Idempotency: unique constraint on stripe_session_id — a replayed webhook
  // is a no-op.
  try {
    await db
      .prepare(
        `INSERT INTO vis_payments (account_id, stripe_session_id, type, amount_cents)
         VALUES (@account_id, @stripe_session_id, @type, @amount_cents)`
      )
      .run({
        account_id: accountId,
        stripe_session_id: session.id,
        type,
        amount_cents: session.amount_total ?? 0,
      });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "23505") return NextResponse.json({ ok: true, deduped: true });
    throw err;
  }

  if (type === "access") {
    await db
      .prepare("UPDATE vis_accounts SET access_granted = true, updated_at = now() WHERE id = ?")
      .run(accountId);
    await logAuditEvent(accountId, "access_granted", "Software access unlocked via one-time payment");
  } else {
    const amountUsd = Number(session.metadata?.amount_usd ?? 0);
    if (amountUsd > 0) {
      await db
        .prepare(
          "INSERT INTO vis_credits_ledger (account_id, delta_usd, reason) VALUES (@account_id, @delta_usd, @reason)"
        )
        .run({ account_id: accountId, delta_usd: amountUsd, reason: `stripe:${session.id}` });
      await logAuditEvent(accountId, "credits_purchased", `$${amountUsd} credit purchased`);
    }
  }

  return NextResponse.json({ ok: true });
}
