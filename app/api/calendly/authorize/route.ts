import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { calendlyAuthorizeUrl } from "@/lib/engine/calendly";

export const dynamic = "force-dynamic";

// Starts the per-tenant Calendly OAuth flow from the Settings page. The
// state cookie is standard OAuth CSRF protection — the callback checks it
// matches before exchanging the code. Account context isn't smuggled through
// state; the callback re-derives it from the still-valid session cookie.
export async function GET() {
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(calendlyAuthorizeUrl(state));
  res.cookies.set("calendly_oauth_state", state, {
    httpOnly: true,
    // `Secure` cookies are silently dropped over plain http://localhost —
    // only require it in production, or local OAuth testing breaks entirely.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
