/**
 * Backend Configuration
 * Server-side only - never expose this to the client
 */

export function getBackendUrl(): string {
  // Use server-side environment variable (no NEXT_PUBLIC_ prefix)
  // This ensures the backend URL is never exposed to the client
  const backendUrl = process.env.BACKEND_API_URL || process.env.API_URL || "http://127.0.0.1:8001";
  return backendUrl.replace(/\/$/, ""); // Remove trailing slash
}
