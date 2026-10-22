import { getAuthConfig } from "./lib/auth-config";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { SupabaseConfigurationError } from "./lib/supabase-config";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";

// Protects everything under /app/* (the cockpit) and /api/* (all routes,
// which have zero auth checks of their own by design — this is the single
// place that gates them). Marketing pages under /(marketing) and the
// /(auth) pages themselves are untouched (not matched below).
export async function proxy(request: NextRequest, event: NextFetchEvent) {
  // The automated-engine webhook is called by Supabase (pg_net trigger + a
  // pg_cron backstop), never by a logged-in browser — there's no browser
  // session to check. It has its own shared-secret check (see the route).
  // The Stripe webhook is the same shape: called server-to-server by Stripe,
  // no browser session, verified by its own signature check instead.
  if (
    request.nextUrl.pathname === "/api/engine/run" ||
    request.nextUrl.pathname === "/api/billing/webhook"
  ) {
    return NextResponse.next();
  }

  let configuration: ReturnType<typeof getAuthConfig>;
  try {
    configuration = getAuthConfig();
  } catch (error) {
    if (!(error instanceof SupabaseConfigurationError)) throw error;
    console.error(error.message);
    // Fail closed: missing configuration must never bypass authentication.
    return NextResponse.json(
      { error: "Authentication is temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (configuration.provider === "clerk") {
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
      publishableKey: configuration.publishableKey,
      secretKey: configuration.secretKey,
      authorizedParties: process.env.NEXT_PUBLIC_SITE_URL
        ? [new URL(process.env.NEXT_PUBLIC_SITE_URL).origin]
        : [request.nextUrl.origin],
    })(request, event);
  }

  // Public auth/marketing pages need Clerk middleware when enabled, but
  // retain their public behavior during the Supabase migration phase.
  if (!/^\/(app|api)(\/|$)/.test(request.nextUrl.pathname)) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(configuration.url, configuration.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options: CookieOptions;
        }[],
      ) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Also refreshes the session cookie if it's near expiry — must be called
  // even on routes that don't strictly need the result.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/api/:path*"],
};
