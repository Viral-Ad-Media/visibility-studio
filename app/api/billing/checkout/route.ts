import { z } from "zod";
import {
  apiRoute,
  parseBody,
  parseId,
  auditInput,
  positiveId,
  idList,
} from "@/lib/api";
import { NextResponse } from "next/server";
import { getCurrentAccountId } from "@/lib/db";
import { supabaseServerClient } from "@/lib/supabase-server";
import { getStripe, ACCESS_FEE_CENTS, CREDIT_PACKS } from "@/lib/stripe";

export const dynamic = "force-dynamic";

async function POSTHandler(req: Request) {
  const {
    data: { user },
  } = await (await supabaseServerClient()).auth.getUser();
  if (!user)
    return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const accountId = await getCurrentAccountId();
  const body = await parseBody(
    req,
    z.discriminatedUnion("type", [
      z.object({ type: z.literal("access") }),
      z.object({
        type: z.literal("credits"),
        amountUsd: z.number().positive(),
      }),
    ]),
  );

  let lineItem: {
    name: string;
    cents: number;
    type: "access" | "credits";
    amountUsd?: number;
  };
  if (body.type === "access") {
    lineItem = {
      name: "Visibility Studio — Access",
      cents: ACCESS_FEE_CENTS,
      type: "access",
    };
  } else if (body.type === "credits") {
    const pack = CREDIT_PACKS.find(
      (p) => p.amountUsd === Number(body.amountUsd),
    );
    if (!pack)
      return NextResponse.json(
        { error: "unknown credit pack" },
        { status: 400 },
      );
    lineItem = {
      name: `Visibility Studio — $${pack.amountUsd} credit`,
      cents: pack.cents,
      type: "credits",
      amountUsd: pack.amountUsd,
    };
  } else {
    return NextResponse.json(
      { error: "unknown checkout type" },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: lineItem.cents,
          product_data: { name: lineItem.name },
        },
      },
    ],
    metadata: {
      account_id: String(accountId),
      type: lineItem.type,
      amount_usd: lineItem.amountUsd ? String(lineItem.amountUsd) : "",
    },
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/billing?success=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/billing?canceled=1`,
  });

  return NextResponse.json({ url: session.url });
}

export const POST = apiRoute(POSTHandler, false);
