"use client";

import { Project } from "@/types";
import { 
  MoreHorizontal, 
  Eye, 
  Edit, 
  Trash, 
  Download, 
  FileText, 
  Ban,
  PlayCircle,
  PauseCircle,
  CheckCircle
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface ProjectActionsProps {
  project: Project;
  onViewDetails?: (project: Project) => void;
  onEdit?: (project: Project) => void;
  onViewDocuments?: (project: Project) => void;
  onStart?: (project: Project) => void;
  onHold?: (project: Project) => void;
  onComplete?: (project: Project) => void;
  onCancel?: (project: Project) => void;
  onDelete?: (project: Project) => void;
  onDownload?: (project: Project) => void;
}

export function ProjectActionsDropdown({
  project,
  onViewDetails,
  onEdit,
  onViewDocuments,
  onStart,
  onHold,
  onComplete,
  onCancel,
  onDelete,
  onDownload,
}: ProjectActionsProps) {
  const handleViewDetails = () => {
    onViewDetails?.(project);
  };

  const handleEditProject = () => {
    onEdit?.(project);
  };

  const handleViewDocuments = () => {
    onViewDocuments?.(project);
  };

  const handleDownload = () => {
    onDownload?.(project);
  };

  const handleStartProject = () => {
    onStart?.(project);
  };

  const handlePutOnHold = () => {
    onHold?.(project);
  };

  const handleCompleteProject = () => {
    onComplete?.(project);
  };

  const handleCancelProject = () => {
    onCancel?.(project);
  };

  const handleDeleteProject = () => {
    onDelete?.(project);
  };

  return (
    <div className="text-right">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={handleViewDetails}>
            <Eye className="mr-2 h-4 w-4" />
            <span>View Details</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleEditProject}>
            <Edit className="mr-2 h-4 w-4" />
            <span>Edit Project</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleViewDocuments}>
            <FileText className="mr-2 h-4 w-4" />
            <span>View Documents</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {project.status === "planning" && (
            <DropdownMenuItem onClick={handleStartProject}>
              <PlayCircle className="mr-2 h-4 w-4" />
              <span>Start Project</span>
            </DropdownMenuItem>
          )}
          {project.status === "execution" && (
            <>
              <DropdownMenuItem onClick={handlePutOnHold}>
                <PauseCircle className="mr-2 h-4 w-4" />
                <span>Put On Hold</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCompleteProject}>
                <CheckCircle className="mr-2 h-4 w-4" />
                <span>Complete Project</span>
              </DropdownMenuItem>
            </>
          )}
          {project.status === "on_hold" && (
            <DropdownMenuItem onClick={handleStartProject}>
              <PlayCircle className="mr-2 h-4 w-4" />
              <span>Resume Project</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            <span>Download</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {project.status !== "cancelled" && project.status !== "completed" && (
            <DropdownMenuItem 
              onClick={handleCancelProject}
              className="text-red-600"
            >
              <Ban className="mr-2 h-4 w-4" />
              <span>Cancel Project</span>
            </DropdownMenuItem>
          )}
          {(project.status === "cancelled" || project.status === "completed") && (
            <DropdownMenuItem 
              onClick={handleDeleteProject}
              className="text-red-600"
            >
              <Trash className="mr-2 h-4 w-4" />
              <span>Delete Project</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
