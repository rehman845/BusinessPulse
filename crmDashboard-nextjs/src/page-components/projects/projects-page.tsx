"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FolderOpen, PlayCircle, Pause, CheckCircle } from "lucide-react";
import { useProjects } from "@/hooks";
import { ProjectsFilters } from "@/components/projects/projects-filters";
import { ProjectsTable } from "@/components/projects/projects-table";
import { NewProjectDialog } from "@/components/projects/new-project-dialog";
import { ProjectDetailsDialog } from "@/components/projects/project-details-dialog";
import { Project } from "@/types";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function ProjectsPage() {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  
  const {
    projects,
    allProjects,
    filters,
    sorting,
    pagination,
    pageCount,
    updateFilters,
    handleSortingChange,
    handlePaginationChange,
    addProject,
    updateProject,
    deleteProject,
  } = useProjects();

  const handleProjectCreated = (project: Project) => {
    if (editingProject) {
      updateProject(editingProject.id, project);
      setEditingProject(null);
      toast.success(`Project "${project.projectName}" updated successfully`);
    } else {
      addProject(project);
      toast.success(`Project "${project.projectName}" created successfully`);
    }
    setDialogOpen(false);
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setDialogOpen(true);
  };

  const handleViewDetails = (project: Project) => {
    setViewingProject(project);
    setDetailsDialogOpen(true);
  };

  const handleStartProject = (project: Project) => {
    updateProject(project.id, { status: "execution" });
    toast.success(`Project "${project.projectName}" started`);
  };

  const handlePutOnHold = (project: Project) => {
    updateProject(project.id, { status: "on_hold" });
    toast.success(`Project "${project.projectName}" put on hold`);
  };

  const handleCompleteProject = (project: Project) => {
    updateProject(project.id, { status: "completed" });
    toast.success(`Project "${project.projectName}" marked as completed`);
  };

  const handleCancelProject = (project: Project) => {
    if (typeof window !== "undefined" && window.confirm(`Are you sure you want to cancel project "${project.projectName}"?`)) {
      updateProject(project.id, { status: "cancelled" });
      toast.success(`Project "${project.projectName}" cancelled`);
    }
  };

  const handleDeleteProject = (project: Project) => {
    if (
      typeof window !== "undefined" &&
      window.confirm(
        `Are you sure you want to delete project "${project.projectName}"? This action cannot be undone.`
      )
    ) {
      deleteProject(project.id);
      toast.success(`Project "${project.projectName}" deleted`);
    }
  };

  const handleViewDocuments = (project: Project) => {
    // Navigate to project detail page which shows documents for this project
    router.push(`/dashboard/projects/${project.id}`);
  };

  const handleDownload = (project: Project) => {
    // Create a JSON file with project data
    const dataStr = JSON.stringify(project, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.projectNumber}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Project data downloaded as ${project.projectNumber}.json`);
  };

  const stats = [
    {
      title: "Total Projects",
      value: allProjects.length,
      icon: FolderOpen,
      color: "text-muted-foreground",
    },
    {
      title: "In Execution",
      value: allProjects.filter((p) => p.status === "execution").length,
      icon: PlayCircle,
      color: "text-green-500",
    },
    {
      title: "On Hold",
      value: allProjects.filter((p) => p.status === "on_hold").length,
      icon: Pause,
      color: "text-yellow-500",
    },
    {
      title: "Completed",
      value: allProjects.filter((p) => p.status === "completed").length,
      icon: CheckCircle,
      color: "text-blue-500",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-2">
            Manage and track all customer projects
          </p>
        </div>
        <Button onClick={() => {
          setEditingProject(null);
          setDialogOpen(true);
        }}>
          <Plus className="mr-2 h-4 w-4" />
          New Project
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
                {index === 0 ? "All time" : stat.title.toLowerCase()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Projects Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Projects</CardTitle>
          <CardDescription>
            View and manage customer projects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <ProjectsFilters filters={filters} onFiltersChange={updateFilters} />
            <ProjectsTable
              projects={projects}
              totalRows={allProjects.length}
              sorting={sorting}
              onSort={handleSortingChange}
              pagination={pagination}
              onPaginationChange={handlePaginationChange}
              pageCount={pageCount}
              onEdit={handleEditProject}
              onViewDetails={handleViewDetails}
              onStart={handleStartProject}
              onHold={handlePutOnHold}
              onComplete={handleCompleteProject}
              onCancel={handleCancelProject}
              onDelete={handleDeleteProject}
              onViewDocuments={handleViewDocuments}
              onDownload={handleDownload}
            />
          </div>
        </CardContent>
      </Card>

      <NewProjectDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingProject(null);
        }}
        onProjectCreated={handleProjectCreated}
        project={editingProject}
      />

      <ProjectDetailsDialog
        project={viewingProject}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
      />
    </div>
  );
}
