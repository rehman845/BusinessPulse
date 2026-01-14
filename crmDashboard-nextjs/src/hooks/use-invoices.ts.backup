import { useState, useMemo, useEffect } from "react";
import { Invoice, InvoiceFilters } from "@/types";
import {
  SortingState,
  PaginationState,
  OnChangeFn,
} from "@tanstack/react-table";

const STORAGE_KEY = "crm_invoices";

// Load invoices from localStorage
function loadInvoicesFromStorage(): Invoice[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {
    console.error("Failed to load invoices from storage", e);
  }
  return [];
}

// Save invoices to localStorage
function saveInvoicesToStorage(invoices: Invoice[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
  } catch (e) {
    console.error("Failed to save invoices to storage", e);
  }
}

interface UseInvoicesProps {
  initialInvoices?: Invoice[];
}

export function useInvoices({ initialInvoices }: UseInvoicesProps = {}) {
  // Initialize from localStorage if available, otherwise use provided initialInvoices
  const [invoicesList, setInvoicesList] = useState<Invoice[]>(() => {
    if (typeof window !== "undefined") {
      const stored = loadInvoicesFromStorage();
      if (stored.length > 0) return stored;
    }
    return initialInvoices || [];
  });

  // Sync with localStorage whenever invoicesList changes
  useEffect(() => {
    saveInvoicesToStorage(invoicesList);
    // Dispatch custom event for same-tab updates
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("crm-invoices-updated"));
    }
  }, [invoicesList]);
  
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

  const filteredInvoices = useMemo(() => {
    return invoicesList.filter((invoice) => {
      // Status filter
      if (filters.status !== "all" && invoice.status !== filters.status) {
        return false;
      }

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const searchableFields = [
          invoice.invoiceNumber,
          invoice.customerName,
          invoice.customerEmail,
          invoice.projectName || "",
          invoice.description || "",
        ].map((field) => field.toLowerCase());

        if (!searchableFields.some((field) => field.includes(searchLower))) {
          return false;
        }
      }

      // Date range filter (check issueDate)
      if (filters.dateRange?.from || filters.dateRange?.to) {
        const invoiceDate = new Date(invoice.issueDate);
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

    // Create a sorting function that makes comparisons based on field type
    const compareValues = (
      a: number | string | Date | undefined,
      b: number | string | Date | undefined,
      desc: boolean
    ): number => {
      const direction = desc ? -1 : 1;

      // Handle different value types
      if (a === b) return 0;

      // Handle null/undefined values
      if (a == null) return direction;
      if (b == null) return -direction;

      // Check if values are dates (try to detect ISO strings)
      if (typeof a === "string" && typeof b === "string") {
        // ISO date format detection
        const isDateA = /^\d{4}-\d{2}-\d{2}(T|\s)/.test(a);
        const isDateB = /^\d{4}-\d{2}-\d{2}(T|\s)/.test(b);

        if (isDateA && isDateB) {
          const dateA = new Date(a).getTime();
          const dateB = new Date(b).getTime();
          return (dateA - dateB) * direction;
        }

        // Regular string comparison
        return a.localeCompare(b) * direction;
      }

      // Number comparison
      if (typeof a === "number" && typeof b === "number") {
        return (a - b) * direction;
      }

      // Default comparison (converts to string)
      return String(a).localeCompare(String(b)) * direction;
    };

    // Apply sorting
    const sortedInvoices = [...filteredInvoices].sort((a, b) => {
      // Handle multi-sorting using sortingState array
      for (const sort of sorting) {
        const key = sort.id as keyof Invoice;
        const compared = compareValues(a[key], b[key], sort.desc);
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
    // Reset to first page when filters change
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

  const addInvoice = (invoice: Invoice) => {
    setInvoicesList((prev) => {
      const updated = [...prev, invoice];
      saveInvoicesToStorage(updated);
      return updated;
    });
  };

  const updateInvoice = (invoiceId: string, updates: Partial<Invoice>) => {
    setInvoicesList((prev) => {
      const updated = prev.map((i) => (i.id === invoiceId ? { ...i, ...updates } : i));
      saveInvoicesToStorage(updated);
      return updated;
    });
  };

  const deleteInvoice = (invoiceId: string) => {
    setInvoicesList((prev) => {
      const updated = prev.filter((i) => i.id !== invoiceId);
      saveInvoicesToStorage(updated);
      return updated;
    });
  };

  // Function to refresh from storage
  const refreshFromStorage = () => {
    const stored = loadInvoicesFromStorage();
    setInvoicesList(stored);
  };

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
    // Refresh from storage
    refreshFromStorage,
  };
}
