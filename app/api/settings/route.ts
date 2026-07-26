import { NextResponse } from "next/server";
import db, { getCurrentAccountId } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const accountId = await getCurrentAccountId();
  const rows = (await db
    .prepare("SELECT key, value FROM vis_settings WHERE account_id = ?")
    .all(accountId)) as { key: string; value: string }[];
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return NextResponse.json(settings);
}

export async function PUT(req: Request) {
  const accountId = await getCurrentAccountId();
  const body = await req.json();
  const entries = Object.entries(body).filter(([, v]) => typeof v === "string");
  await db.transaction(async (tx) => {
    for (const [key, value] of entries) {
      await tx
        .prepare(
          "INSERT INTO vis_settings (account_id, key, value) VALUES (@account_id, @key, @value) " +
            "ON CONFLICT(account_id, key) DO UPDATE SET value=@value"
        )
        .run({ account_id: accountId, key, value });
    }
  });
  return NextResponse.json({ ok: true });
}
