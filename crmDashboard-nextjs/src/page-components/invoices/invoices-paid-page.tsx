"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus, DollarSign, CheckCircle } from "lucide-react";
import { useInvoices } from "@/hooks";
import { InvoicesFilters } from "@/components/invoices/invoices-filters";
import { InvoicesTable } from "@/components/invoices/invoices-table";
import { NewInvoiceDialog } from "@/components/invoices/new-invoice-dialog";
import { Invoice } from "@/types";
import { toast } from "sonner";
import { useState, useMemo } from "react";

export function InvoicesPaidPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  
  const {
    invoices: allInvoices,
    filters,
    sorting,
    pagination,
    pageCount,
    updateFilters,
    handleSortingChange,
    handlePaginationChange,
    addInvoice,
    updateInvoice,
    deleteInvoice,
  } = useInvoices();

  // Filter to show only paid invoices
  const paidInvoices = useMemo(() => {
    return allInvoices.filter((i) => i.status === "paid");
  }, [allInvoices]);

  const filteredPaidInvoices = useMemo(() => {
    let filtered = [...paidInvoices];

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter((invoice) => {
        const searchableFields = [
          invoice.invoiceNumber,
          invoice.customerName,
          invoice.customerEmail,
          invoice.projectName || "",
        ].map((field) => field.toLowerCase());
        return searchableFields.some((field) => field.includes(searchLower));
      });
    }

    // Apply date range filter
    if (filters.dateRange?.from || filters.dateRange?.to) {
      filtered = filtered.filter((invoice) => {
        const invoiceDate = new Date(invoice.paidDate || invoice.issueDate);
        if (filters.dateRange.from && invoiceDate < filters.dateRange.from) {
          return false;
        }
        if (filters.dateRange.to && invoiceDate > filters.dateRange.to) {
          return false;
        }
        return true;
      });
    }

    return filtered;
  }, [paidInvoices, filters]);

  // Apply pagination and sorting to filtered results
  const paginatedInvoices = useMemo(() => {
    let sorted = [...filteredPaidInvoices];
    
    if (sorting.length > 0) {
      sorted = sorted.sort((a, b) => {
        for (const sort of sorting) {
          const key = sort.id as keyof Invoice;
          const aVal = a[key];
          const bVal = b[key];
          if (aVal < bVal) return sort.desc ? 1 : -1;
          if (aVal > bVal) return sort.desc ? -1 : 1;
        }
        return 0;
      });
    }

    const startIdx = pagination.pageIndex * pagination.pageSize;
    const endIdx = startIdx + pagination.pageSize;
    return sorted.slice(startIdx, endIdx);
  }, [filteredPaidInvoices, sorting, pagination]);

  const handleInvoiceCreated = (invoice: Invoice) => {
    if (editingInvoice) {
      updateInvoice(editingInvoice.id, invoice);
      setEditingInvoice(null);
      toast.success(`Invoice "${invoice.invoiceNumber}" updated successfully`);
    } else {
      addInvoice(invoice);
      toast.success(`Invoice "${invoice.invoiceNumber}" created successfully`);
    }
    setDialogOpen(false);
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setDialogOpen(true);
  };

  const handleDeleteInvoice = (invoice: Invoice) => {
    if (
      typeof window !== "undefined" &&
      window.confirm(
        `Are you sure you want to delete invoice "${invoice.invoiceNumber}"? This action cannot be undone.`
      )
    ) {
      deleteInvoice(invoice.id);
      toast.success(`Invoice "${invoice.invoiceNumber}" deleted`);
    }
  };

  const totalPaidAmount = paidInvoices.reduce((sum, i) => sum + i.totalAmount, 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Paid Invoices</h1>
          <p className="text-muted-foreground mt-2">
            View all paid invoices
          </p>
        </div>
        <Button onClick={() => {
          setEditingInvoice(null);
          setDialogOpen(true);
        }}>
          <Plus className="mr-2 h-4 w-4" />
          New Invoice
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Invoices</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paidInvoices.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Successfully paid
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalPaidAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total collected
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Paid Invoices</CardTitle>
          <CardDescription>
            All invoices that have been paid
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <InvoicesFilters 
              filters={{ ...filters, status: "paid" }} 
              onFiltersChange={updateFilters}
              hideStatusFilter={true}
            />
            <InvoicesTable
              invoices={paginatedInvoices}
              totalRows={filteredPaidInvoices.length}
              sorting={sorting}
              onSort={handleSortingChange}
              pagination={pagination}
              onPaginationChange={handlePaginationChange}
              pageCount={Math.ceil(filteredPaidInvoices.length / pagination.pageSize)}
              onEdit={handleEditInvoice}
              onDelete={handleDeleteInvoice}
            />
          </div>
        </CardContent>
      </Card>

      <NewInvoiceDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingInvoice(null);
        }}
        onInvoiceCreated={handleInvoiceCreated}
        invoice={editingInvoice}
      />
    </div>
  );
}
