export class AuthConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthConfigurationError";
  }
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
 * Validates the deployment's Clerk configuration.
 * @param {Record<string, string | undefined>} [env]
 */
export function validateAuthConfig(env = process.env) {
  return validateClerkConfig(
    env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    env.CLERK_SECRET_KEY,
  );
}
