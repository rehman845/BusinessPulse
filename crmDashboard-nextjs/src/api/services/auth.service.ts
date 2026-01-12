/**
 * Authentication Service
 * Handles all authentication-related API calls
 */

import { apiClient } from "../client";
import type { User } from "@/types";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
}

export const authService = {
  /**
   * Login user
   */
  async login(credentials: LoginCredentials) {
    const response = await apiClient.post<LoginResponse>("/auth/login", credentials);
    
    if (response.success && response.data.token) {
      // Store token
      localStorage.setItem("token", response.data.token);
      apiClient.setAuthToken(response.data.token);
    }
    
    return response;
  },

  /**
   * Register new user
   */
  async register(data: RegisterData) {
    const response = await apiClient.post<LoginResponse>("/auth/register", data);
    
    if (response.success && response.data.token) {
      localStorage.setItem("token", response.data.token);
      apiClient.setAuthToken(response.data.token);
    }
    
    return response;
  },

  /**
   * Logout user
   */
  async logout() {
    try {
      await apiClient.post("/auth/logout");
    } finally {
      localStorage.removeItem("token");
      apiClient.removeAuthToken();
    }
  },

  /**
   * Get current user
   */
  async getCurrentUser() {
    return apiClient.get<User>("/auth/me");
  },

  /**
   * Refresh token
   */
  async refreshToken() {
    const response = await apiClient.post<{ token: string }>("/auth/refresh");
    
    if (response.success && response.data.token) {
      localStorage.setItem("token", response.data.token);
      apiClient.setAuthToken(response.data.token);
    }
    
    return response;
  },

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string) {
    return apiClient.post("/auth/forgot-password", { email });
  },

  /**
   * Reset password
   */
  async resetPassword(token: string, newPassword: string) {
    return apiClient.post("/auth/reset-password", { token, password: newPassword });
  },
};

