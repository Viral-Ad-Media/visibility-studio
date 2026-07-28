import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccountId } from "@/lib/db";
import { saveConnection } from "@/lib/engine/calendly";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("calendly_oauth_state")?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(new URL("/app/settings?calendly_error=invalid_state", req.url));
  }

  const accountId = await getCurrentAccountId();
  try {
    await saveConnection(accountId, code);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(
      new URL(`/app/settings?calendly_error=${encodeURIComponent(message)}`, req.url)
    );
  }

  const res = NextResponse.redirect(new URL("/app/settings?calendly_connected=1", req.url));
  res.cookies.delete("calendly_oauth_state");
  return res;
}
