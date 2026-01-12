/**
 * Permission Middleware
 * Handles role-based access control
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/constants";
import { getCurrentUser } from "./auth.middleware";

export type Role = "admin" | "user" | "manager" | "viewer";
export type Permission = "read" | "write" | "delete" | "manage";

/**
 * Check if user has required role
 */
export function hasRole(requiredRole: Role | Role[]): boolean {
  const user = getCurrentUser();
  if (!user || !user.role) return false;

  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  return roles.includes(user.role);
}

/**
 * Check if user has required permission
 */
export function hasPermission(requiredPermission: Permission | Permission[]): boolean {
  const user = getCurrentUser();
  if (!user || !user.permissions) return false;

  const permissions = Array.isArray(requiredPermission) 
    ? requiredPermission 
    : [requiredPermission];
  
  return permissions.some((perm) => user.permissions.includes(perm));
}

/**
 * Hook to protect routes based on role
 */
export function useRoleGuard(requiredRole: Role | Role[]) {
  const router = useRouter();

  useEffect(() => {
    if (!hasRole(requiredRole)) {
      router.push(ROUTES.DASHBOARD.ROOT);
    }
  }, [requiredRole, router]);
}

/**
 * Hook to protect routes based on permission
 */
export function usePermissionGuard(requiredPermission: Permission | Permission[]) {
  const router = useRouter();

  useEffect(() => {
    if (!hasPermission(requiredPermission)) {
      router.push(ROUTES.DASHBOARD.ROOT);
    }
  }, [requiredPermission, router]);
}

/**
 * Higher-order component to protect pages by role
 */
export function withRole<P extends object>(
  Component: React.ComponentType<P>,
  requiredRole: Role | Role[]
): React.ComponentType<P> {
  return function RoleProtectedRoute(props: P) {
    useRoleGuard(requiredRole);
    return <Component {...props} />;
  };
}

/**
 * Higher-order component to protect pages by permission
 */
export function withPermission<P extends object>(
  Component: React.ComponentType<P>,
  requiredPermission: Permission | Permission[]
): React.ComponentType<P> {
  return function PermissionProtectedRoute(props: P) {
    usePermissionGuard(requiredPermission);
    return <Component {...props} />;
  };
}

