import { validateAuthConfig } from "../lib/auth-config-validation.mjs";
import { databaseUrlFromEnv, validateDatabaseUrl } from "../lib/database-config-validation.mjs";
try {
  validateAuthConfig(process.env);
  validateDatabaseUrl(databaseUrlFromEnv(process.env));
  console.log(
    "Clerk Auth and PostgreSQL deployment configuration is present.",
  );
} catch (error) {
  console.error(
    `Deployment configuration error: ${error.message}. Set these variables for the Vercel deployment environment and rebuild.`,
  );
  process.exitCode = 1;
}
