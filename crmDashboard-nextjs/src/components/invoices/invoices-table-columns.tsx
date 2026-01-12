"use client";

import { useMemo } from "react";
import { Invoice, InvoiceStatus } from "@/types";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ColumnDef } from "@tanstack/react-table";
import { InvoiceActionsDropdown } from "./invoices-actions-dropdown";

export const statusColors: Record<InvoiceStatus, string> = {
  draft: "bg-gray-100 text-gray-800",
  sent: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
  overdue: "bg-red-100 text-red-800",
  cancelled: "bg-orange-100 text-orange-800",
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

interface UseInvoiceColumnsProps {
  onEdit?: (invoice: Invoice) => void;
  onDelete?: (invoice: Invoice) => void;
  onMarkAsPaid?: (invoice: Invoice) => void;
  onSend?: (invoice: Invoice) => void;
  onView?: (invoice: Invoice) => void;
  onDownload?: (invoice: Invoice) => void;
}

export const useInvoiceColumns = (handlers?: UseInvoiceColumnsProps) => {
  return useMemo<ColumnDef<Invoice>[]>(
    () => [
      {
        accessorKey: "invoiceNumber",
        header: "Invoice #",
        cell: ({ row }) => (
          <div className="font-medium text-sm">{row.getValue("invoiceNumber")}</div>
        ),
      },
      {
        accessorKey: "customerName",
        header: "Customer",
        cell: ({ row }) => (
          <div className="text-sm">{row.getValue("customerName")}</div>
        ),
      },
      {
        accessorKey: "issueDate",
        header: "Issue Date",
        cell: ({ row }) => (
          <div className="text-sm">
            {format(new Date(row.getValue("issueDate")), "MMM d, yyyy")}
          </div>
        ),
      },
      {
        accessorKey: "dueDate",
        header: "Due Date",
        cell: ({ row }) => (
          <div className="text-sm">
            {format(new Date(row.getValue("dueDate")), "MMM d, yyyy")}
          </div>
        ),
      },
      {
        accessorKey: "totalAmount",
        header: "Amount",
        cell: ({ row }) => (
          <div className="text-sm font-medium">
            {formatCurrency(row.getValue("totalAmount"))}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.getValue("status") as InvoiceStatus;
          const statusLabels: Record<InvoiceStatus, string> = {
            draft: "Draft",
            sent: "Sent",
            paid: "Paid",
            overdue: "Overdue",
            cancelled: "Cancelled",
          };
          return (
            <Badge className={statusColors[status]}>
              {statusLabels[status]}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <InvoiceActionsDropdown invoice={row.original} {...handlers} />
        ),
      },
    ],
    [handlers]
  );
};
