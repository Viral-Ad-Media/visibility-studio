import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Protects everything under /app/* (the cockpit) and /api/* (all routes,
// which have zero auth checks of their own by design — this is the single
// place that gates them). Marketing pages under /(marketing) and the
// /(auth) pages themselves are untouched (not matched below).
export async function middleware(request: NextRequest) {
  // The automated-engine webhook is called by Supabase (pg_net trigger + a
  // pg_cron backstop), never by a logged-in browser — there's no Supabase
  // session to check. It has its own shared-secret check (see the route).
  // The Stripe webhook is the same shape: called server-to-server by Stripe,
  // no browser session, verified by its own signature check instead.
  if (
    request.nextUrl.pathname === "/api/engine/run" ||
    request.nextUrl.pathname === "/api/billing/webhook"
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

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
  matcher: ["/app/:path*", "/api/:path*"],
};
