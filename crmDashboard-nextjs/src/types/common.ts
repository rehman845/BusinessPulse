/**
 * Common Types
 * Shared TypeScript types used across the application
 */

export interface User {
  name: string;
  email: string;
  avatar: string;
}

export interface BaseEntity {
  id: string;
  createdAt?: string;
  updatedAt?: string;
}

export type Status = "active" | "inactive" | "pending" | "completed" | "cancelled";

export interface PaginationParams {
  page: number;
  pageSize: number;
  total?: number;
}

export interface SortParams {
  sortBy: string;
  sortOrder: "asc" | "desc";
}

export interface FilterParams {
  search?: string;
  status?: Status | "all";
  dateRange?: {
    from: Date;
    to: Date;
  };
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

