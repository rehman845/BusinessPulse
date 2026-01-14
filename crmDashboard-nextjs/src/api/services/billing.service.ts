/**
 * Billing Service
 * Handles all billing/expense-related API calls
 */

import { apiClient } from "../client";
import type { BillingExpense, BillingExpenseCreate, BillingExpenseUpdate } from "@/types";

export const billingService = {
  async getExpenses(filters?: {
    expense_type?: string;
    project_id?: string;
    unpaid_only?: boolean;
  }): Promise<BillingExpense[]> {
    const response = await apiClient.get<BillingExpense[]>("/billing/expenses", filters as any);
    return Array.isArray(response.data) ? response.data : [];
  },

  async getExpense(expenseId: string): Promise<BillingExpense> {
    const response = await apiClient.get<BillingExpense>(`/billing/expenses/${expenseId}`);
    return response.data;
  },

  async createExpense(payload: BillingExpenseCreate): Promise<BillingExpense> {
    const response = await apiClient.post<BillingExpense>("/billing/expenses", payload);
    return response.data;
  },

  async updateExpense(expenseId: string, payload: BillingExpenseUpdate): Promise<BillingExpense> {
    const response = await apiClient.patch<BillingExpense>(`/billing/expenses/${expenseId}`, payload);
    return response.data;
  },

  async deleteExpense(expenseId: string): Promise<{ deleted: boolean }> {
    const response = await apiClient.delete<{ deleted: boolean }>(`/billing/expenses/${expenseId}`);
    return response.data;
  },
};
