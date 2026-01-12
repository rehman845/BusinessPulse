"use client";

import { useMemo } from "react";
import { Project, ProjectStatus } from "@/types";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ColumnDef } from "@tanstack/react-table";
import { ProjectActionsDropdown } from "./projects-actions-dropdown";
import Link from "next/link";

export const statusColors: Record<ProjectStatus, string> = {
  planning: "bg-blue-100 text-blue-800",
  execution: "bg-green-100 text-green-800",
  on_hold: "bg-yellow-100 text-yellow-800",
  completed: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

interface UseProjectColumnsProps {
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

export const useProjectColumns = (handlers?: UseProjectColumnsProps) => {
  return useMemo<ColumnDef<Project>[]>(
    () => [
      {
        accessorKey: "projectNumber",
        header: "Project Number",
        cell: ({ row }) => (
          <div className="font-medium text-sm">{row.getValue("projectNumber")}</div>
        ),
      },
      {
        accessorKey: "projectName",
        header: "Project Name",
        cell: ({ row }) => {
          const project = row.original;
          return (
            <Link
              href={`/dashboard/projects/${project.id}`}
              className="font-medium text-primary hover:underline cursor-pointer"
            >
              {project.projectName}
            </Link>
          );
        },
      },
      {
        accessorKey: "customerName",
        header: "Customer",
        cell: ({ row }) => (
          <div className="text-sm">{row.getValue("customerName")}</div>
        ),
      },
      {
        accessorKey: "startDate",
        header: "Start Date",
        cell: ({ row }) => (
          <div className="text-sm">
            {format(new Date(row.getValue("startDate")), "MMM d, yyyy")}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.getValue("status") as ProjectStatus;
          const statusLabels: Record<ProjectStatus, string> = {
            planning: "Planning",
            execution: "In Execution",
            on_hold: "On Hold",
            completed: "Completed",
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
          <ProjectActionsDropdown project={row.original} {...handlers} />
        ),
      },
    ],
    [handlers]
  );
};
