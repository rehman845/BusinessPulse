"use client";

import { Project } from "@/types";
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
import { ProjectsTablePagination } from "./projects-table-pagination";
import { useProjectColumns } from "./projects-table-columns";
import { ProjectsTableHeaderCell } from "./projects-table-header-cell";
import { Separator } from "@/components/ui/separator";

interface ProjectsTableProps {
  projects: Project[];
  totalRows: number;
  sorting: SortingState;
  onSort: OnChangeFn<SortingState>;
  pagination: PaginationState;
  onPaginationChange: OnChangeFn<PaginationState>;
  pageCount: number;
  onEdit?: (project: Project) => void;
  onViewDetails?: (project: Project) => void;
  onStart?: (project: Project) => void;
  onHold?: (project: Project) => void;
  onComplete?: (project: Project) => void;
  onCancel?: (project: Project) => void;
  onDelete?: (project: Project) => void;
  onViewDocuments?: (project: Project) => void;
  onDownload?: (project: Project) => void;
}

export function ProjectsTable({
  projects,
  totalRows,
  sorting,
  onSort,
  pagination,
  onPaginationChange,
  pageCount,
  onEdit,
  onViewDetails,
  onStart,
  onHold,
  onComplete,
  onCancel,
  onDelete,
  onViewDocuments,
  onDownload,
}: ProjectsTableProps) {
  const columns = useProjectColumns({
    onEdit,
    onViewDetails,
    onStart,
    onHold,
    onComplete,
    onCancel,
    onDelete,
    onViewDocuments,
    onDownload,
  });

  const table = useReactTable({
    data: projects,
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

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <ProjectsTableHeaderCell key={header.id} header={header} />
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <Separator />
      <ProjectsTablePagination table={table} totalRows={totalRows} />
    </div>
  );
}
