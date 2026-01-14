/**
 * Invoice Format Conversion Utilities
 * Converts between backend API format (snake_case) and frontend format (camelCase)
 */

import type { Invoice, InvoiceLineItem } from "@/types";

// Backend invoice format (snake_case)
export interface BackendInvoice {
  id: string;
  invoice_number: string;
  customer_id?: string;
  customer_name: string;
  customer_email: string;
  project_id?: string;
  project_name?: string;
  status: string;
  issue_date?: string;
  due_date?: string;
  paid_date?: string;
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  line_items?: BackendInvoiceLineItem[];
}

export interface BackendInvoiceLineItem {
  id: string;
  category: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

/**
 * Convert backend invoice to frontend format
 */
export function backendInvoiceToFrontend(backend: BackendInvoice): Invoice {
  return {
    id: backend.id,
    invoice_number: backend.invoice_number,
    customer_id: backend.customer_id,
    customer_name: backend.customer_name,
    customer_email: backend.customer_email,
    project_id: backend.project_id,
    project_name: backend.project_name,
    status: backend.status as Invoice["status"],
    issue_date: backend.issue_date || "",
    due_date: backend.due_date || "",
    paid_date: backend.paid_date,
    subtotal: backend.subtotal,
    tax: backend.tax,
    total: backend.total,
    notes: backend.notes,
    created_at: backend.created_at,
    updated_at: backend.updated_at,
    line_items: backend.line_items?.map((item) => ({
      id: item.id,
      category: item.category,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.total,
    })),
    // Legacy camelCase fields for compatibility with existing components
    invoiceNumber: backend.invoice_number,
    customerId: backend.customer_id,
    customerName: backend.customer_name,
    customerEmail: backend.customer_email,
    projectId: backend.project_id,
    projectName: backend.project_name,
    issueDate: backend.issue_date || "",
    dueDate: backend.due_date || "",
    paidDate: backend.paid_date,
    amount: backend.subtotal,
    totalAmount: backend.total,
    items: backend.line_items?.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      total: item.total,
    })),
  } as Invoice;
}
