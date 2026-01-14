"use client";

import { Invoice } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  PaginationState,
  OnChangeFn,
} from "@tanstack/react-table";
import { ProjectsTablePagination } from "../projects/projects-table-pagination";
import { useInvoiceColumns } from "./invoices-table-columns";
import { ProjectsTableHeaderCell } from "../projects/projects-table-header-cell";
import { Separator } from "@/components/ui/separator";

interface InvoicesTableProps {
  invoices: Invoice[];
  totalRows: number;
  sorting: SortingState;
  onSort: OnChangeFn<SortingState>;
  pagination: PaginationState;
  onPaginationChange: OnChangeFn<PaginationState>;
  pageCount: number;
  onEdit?: (invoice: Invoice) => void;
  onDelete?: (invoice: Invoice) => void;
  onMarkAsPaid?: (invoice: Invoice) => void;
  onSend?: (invoice: Invoice) => void;
  onView?: (invoice: Invoice) => void;
  onDownload?: (invoice: Invoice) => void;
}

export function InvoicesTable({
  invoices,
  totalRows,
  sorting,
  onSort,
  pagination,
  onPaginationChange,
  pageCount,
  onEdit,
  onDelete,
  onMarkAsPaid,
  onSend,
  onView,
  onDownload,
}: InvoicesTableProps) {
  const columns = useInvoiceColumns({
    onEdit,
    onDelete,
    onMarkAsPaid,
    onSend,
    onView,
    onDownload,
  });

  const table = useReactTable({
    data: invoices,
    columns,
    state: {
      sorting,
      pagination,
    },
    pageCount,
    onSortingChange: onSort,
    onPaginationChange: onPaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    manualSorting: true,
  });

  if (invoices.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            No invoices to display
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <ProjectsTableHeaderCell
                    key={header.id}
                    header={header}
                  />
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Separator />
      <ProjectsTablePagination
        table={table}
        totalRows={totalRows}
      />
    </div>
  );
}
