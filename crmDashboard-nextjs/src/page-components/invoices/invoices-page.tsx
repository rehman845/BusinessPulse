"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus, DollarSign, Clock, AlertCircle, CheckCircle } from "lucide-react";
import { useInvoices } from "@/hooks";
import { InvoicesFilters } from "@/components/invoices/invoices-filters";
import { InvoicesTable } from "@/components/invoices/invoices-table";
import { NewInvoiceDialog } from "@/components/invoices/new-invoice-dialog";
import { Invoice } from "@/types";
import { toast } from "sonner";
import { useState } from "react";

export function InvoicesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  
  const {
    invoices,
    allInvoices,
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

  const handleInvoiceCreated = async (invoice: Invoice) => {
    try {
      if (editingInvoice) {
        await updateInvoice(editingInvoice.id, invoice);
        setEditingInvoice(null);
      } else {
        await addInvoice(invoice);
      }
      // Don't close dialog here - let the dialog handle it after the async operation completes
    } catch (error) {
      // Error toast is handled in the hook
      throw error; // Re-throw so dialog can handle it
    }
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setDialogOpen(true);
  };

  const handleDeleteInvoice = async (invoice: Invoice) => {
    if (
      typeof window !== "undefined" &&
      window.confirm(
        `Are you sure you want to delete invoice "${invoice.invoiceNumber || invoice.invoice_number}"? This action cannot be undone.`
      )
    ) {
      try {
        await deleteInvoice(invoice.id);
      } catch (error) {
        // Error toast is handled in the hook
      }
    }
  };

  const handleMarkAsPaid = async (invoice: Invoice) => {
    try {
      await updateInvoice(invoice.id, {
        status: "paid",
        paidDate: new Date().toISOString(),
        paid_date: new Date().toISOString(),
      });
    } catch (error) {
      // Error toast is handled in the hook
    }
  };

  const handleSendInvoice = async (invoice: Invoice) => {
    try {
      await updateInvoice(invoice.id, { status: "sent" });
    } catch (error) {
      // Error toast is handled in the hook
    }
  };

  const stats = [
    {
      title: "Total Invoices",
      value: allInvoices.length,
      icon: FileText,
      color: "text-muted-foreground",
      subtitle: "All time",
    },
    {
      title: "Paid",
      value: allInvoices.filter((i) => i.status === "paid").length,
      icon: CheckCircle,
      color: "text-green-500",
      subtitle: "paid",
    },
    {
      title: "Overdue",
      value: allInvoices.filter((i) => i.status === "overdue").length,
      icon: AlertCircle,
      color: "text-red-500",
      subtitle: "overdue",
    },
    {
      title: "Pending",
      value: allInvoices.filter((i) => i.status === "sent").length,
      icon: Clock,
      color: "text-yellow-500",
      subtitle: "pending payment",
    },
  ];

  const totalAmount = allInvoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + (i.totalAmount || i.total || 0), 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground mt-2">
            Manage and track all invoices
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
      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {index === 0 ? stat.subtitle : stat.subtitle}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Total Revenue Card */}
      {totalAmount > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              From paid invoices
            </p>
          </CardContent>
        </Card>
      )}

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Invoices</CardTitle>
          <CardDescription>
            View and manage invoices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <InvoicesFilters filters={filters} onFiltersChange={updateFilters} />
            <InvoicesTable
              invoices={invoices}
              totalRows={allInvoices.length}
              sorting={sorting}
              onSort={handleSortingChange}
              pagination={pagination}
              onPaginationChange={handlePaginationChange}
              pageCount={pageCount}
              onEdit={handleEditInvoice}
              onDelete={handleDeleteInvoice}
              onMarkAsPaid={handleMarkAsPaid}
              onSend={handleSendInvoice}
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
