/**
 * Orders Service
 * Handles all order-related API calls
 */

import { apiClient } from "../client";
import type { Order, OrderFilters } from "@/types";

export interface CreateOrderData {
  customerName: string;
  email: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  paymentMethod: string;
}

export interface UpdateOrderData {
  status?: Order["status"];
  items?: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
}

export const ordersService = {
  /**
   * Get all orders
   */
  async getOrders(filters?: OrderFilters) {
    return apiClient.get<Order[]>("/orders", filters as any);
  },

  /**
   * Get single order by ID
   */
  async getOrder(id: string) {
    return apiClient.get<Order>(`/orders/${id}`);
  },

  /**
   * Create new order
   */
  async createOrder(data: CreateOrderData) {
    return apiClient.post<Order>("/orders", data);
  },

  /**
   * Update order
   */
  async updateOrder(id: string, data: UpdateOrderData) {
    return apiClient.patch<Order>(`/orders/${id}`, data);
  },

  /**
   * Delete order
   */
  async deleteOrder(id: string) {
    return apiClient.delete(`/orders/${id}`);
  },

  /**
   * Cancel order
   */
  async cancelOrder(id: string) {
    return apiClient.post(`/orders/${id}/cancel`);
  },

  /**
   * Get order statistics
   */
  async getOrderStats() {
    return apiClient.get<{
      total: number;
      completed: number;
      pending: number;
      processing: number;
      cancelled: number;
    }>("/orders/stats");
  },
};

