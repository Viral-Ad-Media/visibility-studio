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
import db, { getCurrentAccountId } from "@/lib/db";

export const dynamic = "force-dynamic";

async function GETHandler() {
  const accountId = await getCurrentAccountId();
  const rows = (await db
    .prepare("SELECT key, value FROM vis_settings WHERE account_id = ?")
    .all(accountId)) as { key: string; value: string }[];
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return NextResponse.json(settings);
}

async function PUTHandler(req: Request) {
  const accountId = await getCurrentAccountId();
  const body = await parseBody(
    req,
    z
      .object({
        calendly_event_type_uri: z
          .string()
          .max(500)
          .refine(
            (v) =>
              !v ||
              /^https:\/\/api\.calendly\.com\/event_types\/[a-zA-Z0-9-]+$/.test(
                v,
              ),
            "Invalid event type URI",
          ),
      })
      .strict(),
  );
  const entries = Object.entries(body).filter(([, v]) => typeof v === "string");
  await db.transaction(async (tx) => {
    for (const [key, value] of entries) {
      // Explicit RETURNING account_id — lib/db.ts auto-appends "RETURNING id"
      // to any bare INSERT, but vis_settings' primary key is (account_id,
      // key), not id (there's no id column on this table at all).
      await tx
        .prepare(
          "INSERT INTO vis_settings (account_id, key, value) VALUES (@account_id, @key, @value) " +
            "ON CONFLICT(account_id, key) DO UPDATE SET value=@value " +
            "RETURNING account_id",
        )
        .run({ account_id: accountId, key, value });
    }
  });
  return NextResponse.json({ ok: true });
}

export const GET = apiRoute(GETHandler, true);
export const PUT = apiRoute(PUTHandler, true);
