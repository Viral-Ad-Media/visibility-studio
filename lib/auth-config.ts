import {
  AuthConfigurationError,
  resolveAuthProvider,
  validateClerkConfig,
  validateAuthConfig,
} from "./auth-config-validation.mjs";
import { validateSupabaseConfig } from "./supabase-config-validation.mjs";

export {
  AuthConfigurationError,
  resolveAuthProvider,
  validateClerkConfig,
  validateAuthConfig,
};

export type ClerkAuthConfig = {
  provider: "clerk";
  publishableKey: string;
  secretKey: string;
  frontendApi: string;
  issuer: string;
  environment: "live" | "test";
};

export type SupabaseAuthConfig = {
  provider: "supabase";
  url: string;
  key: string;
};

export type AuthConfig = ClerkAuthConfig | SupabaseAuthConfig;

export function getAuthConfig(): AuthConfig {
  const provider = resolveAuthProvider(process.env);
  if (provider === "clerk") {
    return validateClerkConfig(
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      process.env.CLERK_SECRET_KEY,
    ) as ClerkAuthConfig;
  }
  const supabase = validateSupabaseConfig(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return {
    provider: "supabase",
    url: supabase.url,
    key: supabase.key,
  };
}
