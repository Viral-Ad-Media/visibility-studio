import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return NextResponse.json(settings);
}

export async function PUT(req: Request) {
  const body = await req.json();
  const entries = Object.entries(body).filter(([, v]) => typeof v === "string");
  const upsert = db.prepare(
    "INSERT INTO settings (key, value) VALUES (@key, @value) ON CONFLICT(key) DO UPDATE SET value=@value"
  );
  db.transaction(() => {
    for (const [key, value] of entries) upsert.run({ key, value });
  })();
  return NextResponse.json({ ok: true });
}
