export class SupabaseConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "SupabaseConfigurationError";
  }
}

/** @param {string | undefined} urlValue @param {string | undefined} keyValue */
export function validateSupabaseConfig(urlValue, keyValue) {
  const url = urlValue?.trim();
  const key = keyValue?.trim();
  if (!url)
    throw new SupabaseConfigurationError("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key)
    throw new SupabaseConfigurationError(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new SupabaseConfigurationError("Invalid NEXT_PUBLIC_SUPABASE_URL");
  }
  if (
    !["https:", "http:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  ) {
    throw new SupabaseConfigurationError("Invalid NEXT_PUBLIC_SUPABASE_URL");
  }
  let role;
  try {
    role = JSON.parse(atob(key.split(".")[1])).role;
  } catch {
    /* Publishable keys are not JWTs. */
  }
  if (key.startsWith("sb_secret_") || role === "service_role") {
    throw new SupabaseConfigurationError(
      "Use a publishable or anon key for Supabase Auth, never a secret or service_role key",
    );
  }
  return { url, key };
}
