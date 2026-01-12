/**
 * Customers Service
 * Handles all customer-related API calls for Context-Aware System
 */

import { apiClient } from "../client";

export interface Customer {
  id: string;
  name: string;
  created_at?: string;
}

export interface CustomerCreate {
  name: string;
}

export const customersService = {
  /**
   * Get all customers (via SSR API route)
   */
  async getCustomers() {
    const response = await apiClient.get<Customer[]>("/customers");
    // Our backend returns data directly, not wrapped
    return Array.isArray(response.data) ? response.data : response.data?.data || response.data;
  },

  /**
   * Get single customer by ID (via SSR API route)
   */
  async getCustomer(id: string) {
    const response = await apiClient.get<Customer>(`/customers/${id}`);
    return response.data;
  },

  /**
   * Create new customer (via SSR API route)
   */
  async createCustomer(data: CustomerCreate) {
    const response = await apiClient.post<Customer>("/customers", data);
    return response.data;
  },

  /**
   * Delete customer (via SSR API route)
   */
  async deleteCustomer(id: string) {
    const response = await apiClient.delete<{ deleted: boolean }>(`/customers/${id}`);
    return response.data;
  },
};

