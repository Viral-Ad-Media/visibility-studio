import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// Server-side Supabase client bound to the current request's cookies — usable
// from Server Components (read-only cookie access) and Route Handlers/Server
// Actions (can also write refreshed session cookies). The try/catch on
// setAll absorbs the read-only case; middleware is what actually refreshes
// the session cookie on navigations.
export function supabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component render, where cookies are read-only.
          }
        },
      },
    }
  );
}
