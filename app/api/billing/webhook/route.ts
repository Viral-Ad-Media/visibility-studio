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
    payment_status: string | null;
    metadata: Record<string, string> | null;
  };
  // checkout.session.completed also fires for delayed payment methods (bank
  // debits etc.) before the money has actually cleared — only fulfill once
  // Stripe reports it paid.
  if (session.payment_status !== "paid") {
    return NextResponse.json({ ok: true, ignored: `payment_status=${session.payment_status}` });
  }
  const accountId = Number(session.metadata?.account_id);
  const type = session.metadata?.type;
  if (!accountId || (type !== "access" && type !== "credits")) {
    return NextResponse.json({ error: "missing metadata" }, { status: 400 });
  }
  const amountUsd = Number(session.metadata?.amount_usd ?? 0);

  // The payment record and the grant commit together. Idempotency comes from
  // the unique constraint on stripe_session_id — a replayed webhook is a
  // no-op — so if they were separate writes, a crash between them would
  // leave the payment recorded and every Stripe retry deduped, i.e. paid for
  // but never granted.
  try {
    await db.transaction(async (tx) => {
      await tx
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

      if (type === "access") {
        await tx
          .prepare("UPDATE vis_accounts SET access_granted = true, updated_at = now() WHERE id = ?")
          .run(accountId);
      } else if (amountUsd > 0) {
        await tx
          .prepare(
            "INSERT INTO vis_credits_ledger (account_id, delta_usd, reason) VALUES (@account_id, @delta_usd, @reason)"
          )
          .run({ account_id: accountId, delta_usd: amountUsd, reason: `stripe:${session.id}` });
      }
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "23505") return NextResponse.json({ ok: true, deduped: true });
    throw err;
  }

  if (type === "access") {
    await logAuditEvent(accountId, "access_granted", "Software access unlocked via one-time payment");
  } else if (amountUsd > 0) {
    await logAuditEvent(accountId, "credits_purchased", `$${amountUsd} credit purchased`);
  }

  return NextResponse.json({ ok: true });
}
