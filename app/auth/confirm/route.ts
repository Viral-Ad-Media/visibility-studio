import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServerClient } from "@/lib/supabase-server";

// Landing point for Supabase Auth email links (currently password reset).
// Handles both link shapes Supabase can send: the PKCE `?code=` the SDK's
// default template produces, and `?token_hash=&type=` from a customised email
// template. Either way the result is a session cookie, then a redirect to
// `next`, which is restricted to same-site paths like the login form's.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const rawNext = params.get("next") ?? "/app";
  const next =
    rawNext.startsWith("/") &&
    !rawNext.startsWith("//") &&
    !rawNext.startsWith("/\\")
      ? rawNext
      : "/app";

  const supabase = await supabaseServerClient();
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type }))
      .error;
  }

  const target = request.nextUrl.clone();
  target.search = "";
  if (ok) {
    target.pathname = next;
  } else {
    target.pathname = "/forgot-password";
    target.searchParams.set(
      "error",
      "That link is invalid or has expired. Request a new one.",
    );
  }
  return NextResponse.redirect(target);
}
