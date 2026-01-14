/**
 * useInvoices Hook (API-based)
 * Migrated to use backend API instead of localStorage
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import { Invoice, InvoiceFilters } from "@/types";
import {
  SortingState,
  PaginationState,
  OnChangeFn,
} from "@tanstack/react-table";
import { invoicesService } from "@/api/services/invoices.service";
import { backendInvoiceToFrontend } from "@/lib/invoice-utils";
import { toast } from "sonner";
import type { BackendInvoice } from "@/lib/invoice-utils";

export function useInvoices() {
  const [invoicesList, setInvoicesList] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState<InvoiceFilters>({
    status: "all",
    search: "",
    dateRange: {
      from: undefined,
      to: undefined,
    },
  });

  const [sorting, setSorting] = useState<SortingState>([
    { id: "issueDate", desc: true },
  ]);

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  // Load invoices from API
  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const backendInvoices = await invoicesService.getInvoices();
      const converted = backendInvoices.map((inv) => {
        // If it's already in the right format (has camelCase fields), return as-is
        if ((inv as any).invoiceNumber) {
          return inv;
        }
        // Otherwise convert from backend format
        return backendInvoiceToFrontend(inv as unknown as BackendInvoice);
      });
      setInvoicesList(converted);
    } catch (error: any) {
      toast.error("Failed to load invoices", {
        description: error.message || "Please try again",
      });
      console.error("Failed to load invoices:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const filteredInvoices = useMemo(() => {
    return invoicesList.filter((invoice) => {
      // Status filter
      if (filters.status !== "all" && invoice.status !== filters.status) {
        return false;
      }

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const invoiceNumber = invoice.invoiceNumber || invoice.invoice_number || "";
        const customerName = invoice.customerName || invoice.customer_name || "";
        const customerEmail = invoice.customerEmail || invoice.customer_email || "";
        const projectName = invoice.projectName || invoice.project_name || "";
        const description = invoice.description || "";
        
        const searchableFields = [
          invoiceNumber,
          customerName,
          customerEmail,
          projectName,
          description,
        ].map((field) => field.toLowerCase());

        if (!searchableFields.some((field) => field.includes(searchLower))) {
          return false;
        }
      }

      // Date range filter (check issueDate or issue_date)
      if (filters.dateRange?.from || filters.dateRange?.to) {
        const issueDateStr = invoice.issueDate || invoice.issue_date || "";
        if (!issueDateStr) return false;
        const invoiceDate = new Date(issueDateStr);
        if (filters.dateRange.from && invoiceDate < filters.dateRange.from) {
          return false;
        }
        if (filters.dateRange.to && invoiceDate > filters.dateRange.to) {
          return false;
        }
      }

      return true;
    });
  }, [invoicesList, filters]);

  // For TanStack table, we need to handle pagination and sorting separately
  const paginatedAndSortedInvoices = useMemo(() => {
    // Early return if no filters
    if (filteredInvoices.length === 0) return [];

    // Skip sorting if no sort criteria
    if (sorting.length === 0) {
      // Just apply pagination
      const startIdx = pagination.pageIndex * pagination.pageSize;
      const endIdx = startIdx + pagination.pageSize;
      return filteredInvoices.slice(startIdx, endIdx);
    }

    // Create a sorting function
    const compareValues = (
      a: number | string | Date | undefined,
      b: number | string | Date | undefined,
      desc: boolean
    ): number => {
      const direction = desc ? -1 : 1;

      if (a === b) return 0;
      if (a == null) return direction;
      if (b == null) return -direction;

      if (typeof a === "string" && typeof b === "string") {
        const isDateA = /^\d{4}-\d{2}-\d{2}(T|\s)/.test(a);
        const isDateB = /^\d{4}-\d{2}-\d{2}(T|\s)/.test(b);

        if (isDateA && isDateB) {
          const dateA = new Date(a).getTime();
          const dateB = new Date(b).getTime();
          return (dateA - dateB) * direction;
        }

        return a.localeCompare(b) * direction;
      }

      if (typeof a === "number" && typeof b === "number") {
        return (a - b) * direction;
      }

      return String(a).localeCompare(String(b)) * direction;
    };

    // Apply sorting
    const sortedInvoices = [...filteredInvoices].sort((a, b) => {
      for (const sort of sorting) {
        const key = sort.id as keyof Invoice;
        // Handle both camelCase and snake_case
        let valueA: any = a[key];
        let valueB: any = b[key];
        
        // For camelCase keys like "issueDate", also check snake_case
        if (valueA === undefined && key === "issueDate") {
          valueA = a.issue_date;
        }
        if (valueB === undefined && key === "issueDate") {
          valueB = b.issue_date;
        }
        if (valueA === undefined && key === "totalAmount") {
          valueA = a.total;
        }
        if (valueB === undefined && key === "totalAmount") {
          valueB = b.total;
        }
        
        const compared = compareValues(valueA, valueB, sort.desc);
        if (compared !== 0) return compared;
      }
      return 0;
    });

    // Apply pagination
    const startIdx = pagination.pageIndex * pagination.pageSize;
    const endIdx = startIdx + pagination.pageSize;
    return sortedInvoices.slice(startIdx, endIdx);
  }, [filteredInvoices, sorting, pagination]);

  const updateFilters = (newFilters: Partial<InvoiceFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const handleSortingChange: OnChangeFn<SortingState> = (updaterOrValue) => {
    setSorting(
      updaterOrValue instanceof Function
        ? updaterOrValue(sorting)
        : updaterOrValue
    );
  };

  const handlePaginationChange: OnChangeFn<PaginationState> = (
    updaterOrValue
  ) => {
    setPagination(
      updaterOrValue instanceof Function
        ? updaterOrValue(pagination)
        : updaterOrValue
    );
  };

  const handleClearFilters = () => {
    setFilters({
      status: "all",
      search: "",
      dateRange: { from: undefined, to: undefined },
    });
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const addInvoice = async (invoice: Invoice) => {
    try {
      // Convert to backend format and create
      const backendInvoice = await invoicesService.createInvoice({
        invoice_number: invoice.invoice_number || invoice.invoiceNumber || "",
        customer_id: invoice.customer_id || invoice.customerId,
        customer_name: invoice.customer_name || invoice.customerName || "",
        customer_email: invoice.customer_email || invoice.customerEmail || "",
        project_id: invoice.project_id || invoice.projectId,
        project_name: invoice.project_name || invoice.projectName,
        status: invoice.status,
        issue_date: invoice.issue_date || invoice.issueDate,
        due_date: invoice.due_date || invoice.dueDate,
        notes: invoice.notes,
        tax: invoice.tax,
        line_items: (invoice.line_items || invoice.items)?.map((item) => ({
          category: (item as any).category || "other",
          description: item.description,
          quantity: item.quantity,
          unit_price: (item as any).unit_price || (item as any).unitPrice || 0,
        })),
      });
      const converted = backendInvoiceToFrontend(backendInvoice as unknown as BackendInvoice);
      setInvoicesList((prev) => [...prev, converted]);
      toast.success("Invoice created");
    } catch (error: any) {
      toast.error("Failed to create invoice", { description: error.message });
      throw error;
    }
  };

  const updateInvoice = async (invoiceId: string, updates: Partial<Invoice>) => {
    try {
      await invoicesService.updateInvoice(invoiceId, {
        status: updates.status,
        due_date: updates.due_date || updates.dueDate,
        paid_date: updates.paid_date || updates.paidDate,
        notes: updates.notes,
      });
      // Reload invoices to get latest data
      await loadInvoices();
      toast.success("Invoice updated");
    } catch (error: any) {
      toast.error("Failed to update invoice", { description: error.message });
      throw error;
    }
  };

  const deleteInvoice = async (invoiceId: string) => {
    try {
      await invoicesService.deleteInvoice(invoiceId);
      setInvoicesList((prev) => prev.filter((i) => i.id !== invoiceId));
      toast.success("Invoice deleted");
    } catch (error: any) {
      toast.error("Failed to delete invoice", { description: error.message });
      throw error;
    }
  };

  const refreshFromStorage = loadInvoices;

  return {
    // Raw filtered invoices (no pagination applied)
    allInvoices: filteredInvoices,
    // Invoices with pagination and sorting applied
    invoices: paginatedAndSortedInvoices,
    // Total count for pagination
    pageCount: Math.ceil(filteredInvoices.length / pagination.pageSize),
    // States
    filters,
    sorting,
    pagination,
    loading,
    // Update handlers
    updateFilters,
    handleSortingChange,
    handlePaginationChange,
    handleClearFilters,
    // Invoice management
    addInvoice,
    updateInvoice,
    deleteInvoice,
    // All invoices (unfiltered)
    allInvoicesList: invoicesList,
    // Refresh from API
    refreshFromStorage,
    // Reload function
    loadInvoices,
  };
}
