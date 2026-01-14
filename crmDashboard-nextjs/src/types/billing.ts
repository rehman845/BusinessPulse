/**
 * Billing/Expenses Types
 */

export type ExpenseType = "subscription" | "vendor" | "consultant" | "other";
export type ExpenseFrequency = "one_time" | "monthly" | "yearly";

export interface BillingExpense {
  id: string;
  expense_type: ExpenseType;
  vendor_name: string;
  description: string;
  amount: number;
  currency: string;
  frequency: ExpenseFrequency;
  due_date?: string;
  paid_date?: string;
  project_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BillingExpenseCreate {
  expense_type?: ExpenseType;
  vendor_name: string;
  description?: string;
  amount: number;
  currency?: string;
  frequency?: ExpenseFrequency;
  due_date?: string;
  paid_date?: string;
  project_id?: string;
}

export interface BillingExpenseUpdate {
  expense_type?: ExpenseType;
  vendor_name?: string;
  description?: string;
  amount?: number;
  currency?: string;
  frequency?: ExpenseFrequency;
  due_date?: string;
  paid_date?: string;
  project_id?: string;
}
