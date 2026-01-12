/**
 * Authentication Middleware
 * Handles authentication checks for protected routes
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/constants";

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  
  const token = localStorage.getItem("token");
  const user = localStorage.getItem("user");
  
  return !!(token && user);
}

/**
 * Get current user from storage
 */
export function getCurrentUser() {
  if (typeof window === "undefined") return null;
  
  const userStr = localStorage.getItem("user");
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Hook to protect routes (requires authentication)
 */
export function useAuthGuard() {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push(ROUTES.HOME);
    }
  }, [router]);
}

/**
 * Hook to redirect if already authenticated
 */
export function useGuestGuard() {
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated()) {
      router.push(ROUTES.DASHBOARD.ROOT);
    }
  }, [router]);
}

/**
 * Higher-order component to protect pages
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  return function ProtectedRoute(props: P) {
    useAuthGuard();
    return <Component {...props} />;
  };
}

/**
 * Higher-order component for guest-only pages
 */
export function withGuest<P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  return function GuestRoute(props: P) {
    useGuestGuard();
    return <Component {...props} />;
  };
}

