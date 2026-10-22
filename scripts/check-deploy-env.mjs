import { validateAuthConfig } from "../lib/auth-config-validation.mjs";
import { validateDatabaseUrl } from "../lib/database-config-validation.mjs";
try {
  const auth = validateAuthConfig(process.env);
  validateDatabaseUrl(process.env.DATABASE_URL);
  console.log(
    `${auth.provider === "clerk" ? "Clerk" : "Supabase"} Auth and PostgreSQL deployment configuration is present.`,
  );
} catch (error) {
  console.error(
    `Deployment configuration error: ${error.message}. Set these variables for the Vercel deployment environment and rebuild.`,
  );
  process.exitCode = 1;
}
