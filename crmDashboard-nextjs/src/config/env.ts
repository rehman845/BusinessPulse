/**
 * Environment Configuration
 * Centralized environment variable access with type safety
 */

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    // Only throw in production, warn in development
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Missing environment variable: ${key}`);
    }
    console.warn(`Warning: Missing environment variable: ${key}`);
    return "";
  }
  return value;
}

function getOptionalEnvVar(key: string, defaultValue?: string): string | undefined {
  return process.env[key] || defaultValue;
}

export const env = {
  // App
  NODE_ENV: getEnvVar("NODE_ENV", "development"),
  APP_URL: getOptionalEnvVar("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
  
  // Auth
  ADMIN_EMAIL: getEnvVar("NEXT_PUBLIC_ADMIN_EMAIL", "admin@example.com"),
  ADMIN_PASSWORD: getEnvVar("NEXT_PUBLIC_ADMIN_PASSWORD", "admin123"),
  ADMIN_NAME: getEnvVar("NEXT_PUBLIC_ADMIN_NAME", "Admin User"),
  
  // Feature Flags
  IS_PRODUCTION: process.env.NODE_ENV === "production",
  IS_DEVELOPMENT: process.env.NODE_ENV === "development",
} as const;

export type Env = typeof env;

