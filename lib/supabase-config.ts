import { validateSupabaseConfig } from "./supabase-config-validation.mjs";

export { SupabaseConfigurationError } from "./supabase-config-validation.mjs";

export function getSupabaseConfig() {
  // Keep literal NEXT_PUBLIC_ accesses so Next.js can inline them at build time.
  return validateSupabaseConfig(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
