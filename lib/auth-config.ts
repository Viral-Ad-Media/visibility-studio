import {
  AuthConfigurationError,
  validateClerkConfig,
  validateAuthConfig,
} from "./auth-config-validation.mjs";

export { AuthConfigurationError, validateClerkConfig, validateAuthConfig };

export type AuthConfig = {
  provider: "clerk";
  publishableKey: string;
  secretKey: string;
  frontendApi: string;
  issuer: string;
  environment: "live" | "test";
};

export function getAuthConfig(): AuthConfig {
  return validateClerkConfig(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    process.env.CLERK_SECRET_KEY,
  ) as AuthConfig;
}
