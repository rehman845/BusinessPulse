"use client";

import { Project } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { statusColors } from "./projects-table-columns";

interface ProjectDetailsDialogProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusLabels: Record<Project["status"], string> = {
  planning: "Planning",
  execution: "In Execution",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function ProjectDetailsDialog({
  project,
  open,
  onOpenChange,
}: ProjectDetailsDialogProps) {
  if (!project) return null;

  const formatCurrency = (amount?: number) => {
    if (!amount) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{project.projectName}</span>
            <Badge className={statusColors[project.status]}>
              {statusLabels[project.status]}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Project Number: {project.projectNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-1">
                Customer
              </h4>
              <p className="text-base">{project.customerName}</p>
              {project.email && (
                <p className="text-sm text-muted-foreground">{project.email}</p>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-1">
                Assigned To
              </h4>
              <p className="text-base">
                {project.assignedTo || "Not assigned"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-1">
                Start Date
              </h4>
              <p className="text-base">
                {format(new Date(project.startDate), "PP")}
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-1">
                End Date
              </h4>
              <p className="text-base">
                {project.endDate
                  ? format(new Date(project.endDate), "PP")
                  : "Not set"}
              </p>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-1">
              Budget
            </h4>
            <p className="text-base">{formatCurrency(project.budget)}</p>
          </div>

          {project.description && (
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-1">
                Description
              </h4>
              <p className="text-base whitespace-pre-wrap">
                {project.description}
              </p>
            </div>
          )}

          {project.customerId && (
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-1">
                Customer ID
              </h4>
              <p className="text-base font-mono text-sm">{project.customerId}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
