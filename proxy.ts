import { AuthConfigurationError, getAuthConfig } from "./lib/auth-config";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";

// Protects everything under /app/* (the cockpit) and /api/* (all routes,
// which have zero auth checks of their own by design — this is the single
// place that gates them). Marketing pages under /(marketing) and the
// /(auth) pages themselves are untouched (not matched below).
export async function proxy(request: NextRequest, event: NextFetchEvent) {
  // The automated-engine endpoint is called server-to-server (the app's own
  // dispatch and the Vercel cron backstop), never by a logged-in browser —
  // there's no browser session to check. It has its own secret check.
  // The Stripe webhook is the same shape: called server-to-server by Stripe,
  // no browser session, verified by its own signature check instead.
  if (
    request.nextUrl.pathname === "/api/engine/run" ||
    request.nextUrl.pathname === "/api/billing/webhook"
  ) {
    return NextResponse.next();
  }

  try {
    getAuthConfig();
  } catch (error) {
    if (!(error instanceof AuthConfigurationError)) throw error;
    console.error(error.message);
    // Fail closed: missing configuration must never bypass authentication.
    return NextResponse.json(
      { error: "Authentication is temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return clerkMiddleware(async (auth, req) => {
    const protectedPath = /^\/(app|api|admin|billing|onboarding)(\/|$)/.test(req.nextUrl.pathname);
    if (!protectedPath) return NextResponse.next();
    const { userId } = await auth();
    if (!userId) {
      if (req.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("next", req.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }, {
    // The SDK reads the keys from the environment. Passing secretKey here
    // would require CLERK_ENCRYPTION_KEY and crash every request without it.
    authorizedParties: process.env.NEXT_PUBLIC_SITE_URL
      ? [new URL(process.env.NEXT_PUBLIC_SITE_URL).origin]
      : [request.nextUrl.origin],
  })(request, event);
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/api/:path*"],
};
