import {
  SupabaseConfigurationError,
  validateSupabaseConfig,
} from "./supabase-config-validation.mjs";

export class AuthConfigurationError extends SupabaseConfigurationError {
  constructor(message) {
    super(message);
    this.name = "AuthConfigurationError";
  }
}

/**
 * Resolves the active authentication provider for the deployment.
 * One provider governs a deployment; never allow a request header or cookie to choose it.
 * @param {Record<string, string | undefined>} [env]
 * @returns {"clerk" | "supabase"}
 */
export function resolveAuthProvider(env = process.env) {
  const explicit = env.VIS_AUTH_PROVIDER?.trim().toLowerCase();
  if (explicit) {
    if (explicit === "clerk" || explicit === "supabase") {
      return explicit;
    }
    throw new AuthConfigurationError(
      "Invalid VIS_AUTH_PROVIDER: expected 'clerk' or 'supabase'",
    );
  }

  // Credentials may be staged before the database and identities are migrated.
  return "supabase";
}

/**
 * Validates Clerk publishable and secret keys and extracts the instance issuer.
 * Never includes secret or key values in thrown error messages.
 * @param {string | undefined} publishableKeyValue
 * @param {string | undefined} secretKeyValue
 */
export function validateClerkConfig(publishableKeyValue, secretKeyValue) {
  const publishableKey = publishableKeyValue?.trim();
  const secretKey = secretKeyValue?.trim();

  if (!publishableKey) {
    throw new AuthConfigurationError(
      "Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    );
  }
  if (
    publishableKey.startsWith("sk_") ||
    publishableKey.startsWith("sb_secret_")
  ) {
    throw new AuthConfigurationError(
      "Use a Clerk publishable key in NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, never a secret key",
    );
  }

  const pkMatch = publishableKey.match(
    /^pk_(live|test)_([A-Za-z0-9+/=_-]+)$/,
  );
  if (!pkMatch) {
    throw new AuthConfigurationError(
      "Invalid NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    );
  }

  let decodedHost = "";
  try {
    decodedHost = Buffer.from(pkMatch[2], "base64").toString("utf8");
  } catch {
    throw new AuthConfigurationError(
      "Invalid NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    );
  }
  if (!decodedHost.endsWith("$") || decodedHost.length <= 1) {
    throw new AuthConfigurationError(
      "Invalid NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    );
  }

  const frontendApi = decodedHost.slice(0, -1).trim();
  let issuerUrl;
  try {
    issuerUrl = new URL(`https://${frontendApi}`);
  } catch {
    throw new AuthConfigurationError(
      "Invalid NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    );
  }
  if (
    issuerUrl.hostname !== frontendApi ||
    !frontendApi.includes(".") ||
    issuerUrl.username ||
    issuerUrl.password
  ) {
    throw new AuthConfigurationError(
      "Invalid NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    );
  }

  if (!secretKey) {
    throw new AuthConfigurationError("Missing CLERK_SECRET_KEY");
  }
  if (secretKey.startsWith("pk_")) {
    throw new AuthConfigurationError(
      "Use a Clerk secret key in CLERK_SECRET_KEY, never a publishable key",
    );
  }
  const skMatch = secretKey.match(/^sk_(live|test)_[A-Za-z0-9+/=_-]+$/);
  if (!skMatch) {
    throw new AuthConfigurationError("Invalid CLERK_SECRET_KEY");
  }
  if (pkMatch[1] !== skMatch[1]) {
    throw new AuthConfigurationError(
      "Clerk key environment mismatch between NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY",
    );
  }

  return {
    provider: /** @type {const} */ ("clerk"),
    publishableKey,
    secretKey,
    frontendApi,
    issuer: `https://${frontendApi}`,
    environment: /** @type {"live" | "test"} */ (pkMatch[1]),
  };
}

/**
 * Validates the active authentication provider's configuration.
 * @param {Record<string, string | undefined>} [env]
 */
export function validateAuthConfig(env = process.env) {
  const provider = resolveAuthProvider(env);
  if (provider === "clerk") {
    return validateClerkConfig(
      env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      env.CLERK_SECRET_KEY,
    );
  }
  const supabase = validateSupabaseConfig(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return {
    provider: /** @type {const} */ ("supabase"),
    ...supabase,
  };
}
