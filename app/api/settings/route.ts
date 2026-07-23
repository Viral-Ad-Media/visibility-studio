import { NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = (await db.prepare("SELECT key, value FROM vis_settings").all()) as {
    key: string;
    value: string;
  }[];
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return NextResponse.json(settings);
}

export async function PUT(req: Request) {
  const body = await req.json();
  const entries = Object.entries(body).filter(([, v]) => typeof v === "string");
  await db.transaction(async (tx) => {
    for (const [key, value] of entries) {
      await tx
        .prepare(
          "INSERT INTO vis_settings (key, value) VALUES (@key, @value) ON CONFLICT(key) DO UPDATE SET value=@value"
        )
        .run({ key, value });
    }
  });
  return NextResponse.json({ ok: true });
}
