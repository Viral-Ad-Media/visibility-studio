import { validateSupabaseConfig } from "../lib/supabase-config-validation.mjs";
import { validateDatabaseUrl } from "../lib/database-config-validation.mjs";
try {
  validateSupabaseConfig(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  validateDatabaseUrl(process.env.DATABASE_URL);
  console.log("Supabase Auth and PostgreSQL deployment configuration is present.");
} catch (error) {
  console.error(
    `Deployment configuration error: ${error.message}. Set these variables for the Vercel deployment environment and rebuild.`,
  );
  process.exitCode = 1;
}
