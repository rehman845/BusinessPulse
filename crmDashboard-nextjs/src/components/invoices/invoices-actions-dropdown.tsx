"use client";

import { Invoice } from "@/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash, Check, Send, Eye, Download } from "lucide-react";

interface InvoiceActionsDropdownProps {
  invoice: Invoice;
  onEdit?: (invoice: Invoice) => void;
  onDelete?: (invoice: Invoice) => void;
  onMarkAsPaid?: (invoice: Invoice) => void;
  onSend?: (invoice: Invoice) => void;
  onView?: (invoice: Invoice) => void;
  onDownload?: (invoice: Invoice) => void;
}

export function InvoiceActionsDropdown({
  invoice,
  onEdit,
  onDelete,
  onMarkAsPaid,
  onSend,
  onView,
  onDownload,
}: InvoiceActionsDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onView && (
          <DropdownMenuItem onClick={() => onView(invoice)}>
            <Eye className="mr-2 h-4 w-4" />
            View
          </DropdownMenuItem>
        )}
        {onEdit && invoice.status !== "paid" && invoice.status !== "cancelled" && (
          <DropdownMenuItem onClick={() => onEdit(invoice)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
        )}
        {onSend && (invoice.status === "draft" || invoice.status === "sent") && (
          <DropdownMenuItem onClick={() => onSend(invoice)}>
            <Send className="mr-2 h-4 w-4" />
            Send
          </DropdownMenuItem>
        )}
        {onMarkAsPaid && invoice.status !== "paid" && invoice.status !== "cancelled" && (
          <DropdownMenuItem onClick={() => onMarkAsPaid(invoice)}>
            <Check className="mr-2 h-4 w-4" />
            Mark as Paid
          </DropdownMenuItem>
        )}
        {onDownload && (
          <DropdownMenuItem onClick={() => onDownload(invoice)}>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </DropdownMenuItem>
        )}
        {(onEdit || onDelete) && <DropdownMenuSeparator />}
        {onDelete && (
          <DropdownMenuItem
            onClick={() => onDelete(invoice)}
            className="text-red-600"
          >
            <Trash className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
