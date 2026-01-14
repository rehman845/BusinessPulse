export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
export type InvoiceLineCategory = 'labor' | 'subscription' | 'vendor' | 'other';

// Invoice type with both snake_case (backend) and camelCase (legacy frontend) for compatibility
export interface Invoice {
  id: string;
  // Backend format (snake_case)
  invoice_number: string;
  customer_id?: string;
  customer_name: string;
  customer_email: string;
  project_id?: string;
  project_name?: string;
  status: InvoiceStatus;
  issue_date?: string;
  due_date?: string;
  paid_date?: string;
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  line_items?: InvoiceLineItem[];
  // Legacy frontend format (camelCase) - for backward compatibility
  invoiceNumber?: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  projectId?: string;
  projectName?: string;
  issueDate?: string;
  dueDate?: string;
  paidDate?: string;
  amount?: number;
  totalAmount?: number;
  items?: InvoiceItem[];
  description?: string;
}

export interface InvoiceLineItem {
  id: string;
  category: InvoiceLineCategory;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

// Legacy/compatibility types (camelCase) - for backward compatibility with existing code
export interface InvoiceLegacy {
  id: string;
  invoiceNumber: string;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  projectId?: string;
  projectName?: string;
  amount: number;
  tax?: number;
  totalAmount: number;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  description?: string;
  items?: InvoiceItem[];
  notes?: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoiceFilters {
  status: InvoiceStatus | 'all';
  search: string;
  dateRange: {
    from: Date | undefined;
    to: Date | undefined;
  };
}

export interface InvoiceGenerateRequest {
  project_id: string;
  customer_id?: string;
  customer_name?: string;
  customer_email?: string;
  project_name?: string;
  from_date?: string;
  to_date?: string;
  tax_rate?: number;
  include_project_expenses?: boolean;
  include_time_entries?: boolean;
  invoice_number?: string;
}
