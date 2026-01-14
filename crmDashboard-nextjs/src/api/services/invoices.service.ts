/**
 * Invoices Service
 * Handles all invoice-related API calls
 */

import { apiClient } from "../client";
import type { Invoice, InvoiceGenerateRequest } from "@/types";

export interface InvoiceCreate {
  invoice_number: string;
  customer_id?: string;
  customer_name: string;
  customer_email: string;
  project_id?: string;
  project_name?: string;
  status?: string;
  issue_date?: string;
  due_date?: string;
  notes?: string;
  tax?: number;
  line_items?: Array<{
    category: string;
    description: string;
    quantity: number;
    unit_price: number;
  }>;
}

export interface InvoiceUpdate {
  status?: string;
  due_date?: string;
  paid_date?: string;
  notes?: string;
}

export const invoicesService = {
  async getInvoices(filters?: {
    status?: string;
    project_id?: string;
    customer_id?: string;
  }): Promise<Invoice[]> {
    const response = await apiClient.get<Invoice[]>("/invoices", filters as any);
    return Array.isArray(response.data) ? response.data : [];
  },

  async getInvoice(invoiceId: string): Promise<Invoice> {
    const response = await apiClient.get<Invoice>(`/invoices/${invoiceId}`);
    return response.data;
  },

  async createInvoice(payload: InvoiceCreate): Promise<Invoice> {
    const response = await apiClient.post<Invoice>("/invoices", payload);
    return response.data;
  },

  async updateInvoice(invoiceId: string, payload: InvoiceUpdate): Promise<Invoice> {
    const response = await apiClient.patch<Invoice>(`/invoices/${invoiceId}`, payload);
    return response.data;
  },

  async deleteInvoice(invoiceId: string): Promise<{ deleted: boolean }> {
    const response = await apiClient.delete<{ deleted: boolean }>(`/invoices/${invoiceId}`);
    return response.data;
  },

  async generateInvoice(payload: InvoiceGenerateRequest): Promise<Invoice> {
    const response = await apiClient.post<Invoice>("/invoices/generate", payload);
    return response.data;
  },
};
