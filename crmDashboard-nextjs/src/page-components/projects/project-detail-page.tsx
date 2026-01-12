"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Project } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Download, Trash, PlayCircle, PauseCircle, CheckCircle, Ban, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { statusColors } from "@/components/projects/projects-table-columns";
import { NewProjectDialog } from "@/components/projects/new-project-dialog";
import { useProjects } from "@/hooks";
import { documentsService, type Document } from "@/api";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDocType } from "@/lib/utils";

interface ProjectDetailPageProps {
  projectId: string;
}

const statusLabels: Record<Project["status"], string> = {
  planning: "Planning",
  execution: "In Execution",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function ProjectDetailPage({ projectId }: ProjectDetailPageProps) {
  const router = useRouter();
  const { allProjectsList, updateProject, deleteProject, refreshFromStorage } = useProjects();
  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProjectDocuments = async (customerId: string) => {
    try {
      setLoadingDocs(true);
      const docs = await documentsService.getCustomerDocuments(customerId, projectId);
      setDocuments(docs);
    } catch (error: any) {
      toast.error("Failed to load documents", { description: error.message || "Please try again" });
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    // Function to load project from localStorage directly
    const loadProjectFromStorage = (): Project | null => {
      if (typeof window === "undefined") return null;
      
      try {
        const stored = localStorage.getItem("crm_projects");
        if (stored) {
          const parsed = JSON.parse(stored);
          const storedProjects = Array.isArray(parsed) ? parsed : [];
          return storedProjects.find((p: Project) => p.id === projectId) || null;
        }
      } catch (e) {
        console.error("Failed to load projects from storage", e);
      }
      return null;
    };

    const findAndLoadProject = () => {
      // Try localStorage first (most reliable)
      let foundProject = loadProjectFromStorage();
      
      // Fallback to hook state
      if (!foundProject) {
        foundProject = allProjectsList.find((p) => p.id === projectId);
      }

      if (foundProject) {
        setProject(foundProject);
        setLoading(false);
        // Load documents for this project
        if (foundProject.customerId) {
          loadProjectDocuments(foundProject.customerId);
        }
        return true;
      }
      return false;
    };

    // Refresh hook state from storage first
    refreshFromStorage();

    // Try to load immediately
    if (findAndLoadProject()) {
      return;
    }

    // If not found, wait a moment for state to sync and try again
    const timer1 = setTimeout(() => {
      if (findAndLoadProject()) {
        return;
      }
      // One more retry after a bit more time
      setTimeout(() => {
        if (!findAndLoadProject()) {
          setLoading(false);
          toast.error("Project not found. Redirecting to projects list...");
          setTimeout(() => {
            router.push("/dashboard/projects");
          }, 2000);
        }
      }, 400);
    }, 150);

    return () => clearTimeout(timer1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Listen for storage events and custom events to sync when projects are updated
  useEffect(() => {
    if (typeof window === "undefined" || !project) return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "crm_projects") {
        // Reload project if storage was updated
        try {
          const stored = e.newValue;
          if (stored) {
            const parsed = JSON.parse(stored);
            const storedProjects = Array.isArray(parsed) ? parsed : [];
            const updatedProject = storedProjects.find((p: Project) => p.id === projectId);
            if (updatedProject) {
              setProject(updatedProject);
            }
          }
        } catch (err) {
          console.error("Failed to sync project from storage event", err);
        }
      }
    };

    const handleProjectsUpdate = () => {
      // Reload from localStorage when projects are updated
      try {
        const stored = localStorage.getItem("crm_projects");
        if (stored) {
          const parsed = JSON.parse(stored);
          const storedProjects = Array.isArray(parsed) ? parsed : [];
          const updatedProject = storedProjects.find((p: Project) => p.id === projectId);
          if (updatedProject) {
            setProject(updatedProject);
          }
        }
      } catch (err) {
        console.error("Failed to sync project from custom event", err);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("crm-projects-updated", handleProjectsUpdate);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("crm-projects-updated", handleProjectsUpdate);
    };
  }, [projectId, project]);

  const handleProjectUpdated = (updatedProject: Project) => {
    setProject(updatedProject);
    updateProject(projectId, updatedProject);
  };

  const handleEdit = () => {
    setEditDialogOpen(true);
  };

  const handleDelete = () => {
    if (!project) return;
    if (
      typeof window !== "undefined" &&
      window.confirm(
        `Are you sure you want to delete project "${project.projectName}"? This action cannot be undone.`
      )
    ) {
      deleteProject(projectId);
      toast.success(`Project "${project.projectName}" deleted`);
      router.push("/dashboard/projects");
    }
  };

  const handleStatusChange = (newStatus: Project["status"]) => {
    if (!project) return;
    updateProject(projectId, { status: newStatus });
    setProject({ ...project, status: newStatus });
    const statusMessages: Record<Project["status"], string> = {
      planning: "Project set to planning",
      execution: "Project started",
      on_hold: "Project put on hold",
      completed: "Project completed",
      cancelled: "Project cancelled",
    };
    toast.success(statusMessages[newStatus]);
  };

  const handleDownload = () => {
    if (!project) return;
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

  const handleViewDocuments = () => {
    if (!project?.customerId) {
      toast.error("Customer ID not found for this project");
      return;
    }
    // Scroll to documents section (which we'll add below)
    const documentsSection = document.getElementById("project-documents");
    if (documentsSection) {
      documentsSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/projects")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              {project.projectName}
              <Badge className={statusColors[project.status]}>
                {statusLabels[project.status]}
              </Badge>
            </h1>
            <p className="text-muted-foreground mt-2">
              {project.projectNumber}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {project.status === "planning" && (
            <Button onClick={() => handleStatusChange("execution")}>
              <PlayCircle className="mr-2 h-4 w-4" />
              Start Project
            </Button>
          )}
          {project.status === "execution" && (
            <>
              <Button
                variant="outline"
                onClick={() => handleStatusChange("on_hold")}
              >
                <PauseCircle className="mr-2 h-4 w-4" />
                Put On Hold
              </Button>
              <Button onClick={() => handleStatusChange("completed")}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Complete
              </Button>
            </>
          )}
          {project.status === "on_hold" && (
            <Button onClick={() => handleStatusChange("execution")}>
              <PlayCircle className="mr-2 h-4 w-4" />
              Resume Project
            </Button>
          )}
          <Button variant="outline" onClick={handleViewDocuments}>
            <FileText className="mr-2 h-4 w-4" />
            View Documents
          </Button>
          <Button variant="outline" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
          <Button variant="outline" onClick={handleEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          {(project.status === "cancelled" || project.status === "completed") && (
            <Button variant="destructive" onClick={handleDelete}>
              <Trash className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
          {project.status !== "cancelled" &&
            project.status !== "completed" && (
              <Button
                variant="destructive"
                onClick={() => handleStatusChange("cancelled")}
              >
                <Ban className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Project Information */}
        <Card>
          <CardHeader>
            <CardTitle>Project Information</CardTitle>
            <CardDescription>Basic project details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-1">
                Project Name
              </h4>
              <p className="text-base">{project.projectName}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-1">
                Project Number
              </h4>
              <p className="text-base font-mono">{project.projectNumber}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-1">
                Status
              </h4>
              <Badge className={statusColors[project.status]}>
                {statusLabels[project.status]}
              </Badge>
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
          </CardContent>
        </Card>

        {/* Customer Information */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
            <CardDescription>Client details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-1">
                Customer Name
              </h4>
              <p className="text-base">{project.customerName}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-1">
                Email
              </h4>
              <p className="text-base">{project.email || "N/A"}</p>
            </div>
            {project.customerId && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-1">
                  Customer ID
                </h4>
                <p className="text-base font-mono text-sm">{project.customerId}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dates & Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
            <CardDescription>Project dates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
            {project.startDate && project.endDate && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-1">
                  Duration
                </h4>
                <p className="text-base">
                  {Math.ceil(
                    (new Date(project.endDate).getTime() -
                      new Date(project.startDate).getTime()) /
                      (1000 * 60 * 60 * 24)
                  )}{" "}
                  days
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Budget & Assignment */}
        <Card>
          <CardHeader>
            <CardTitle>Budget & Assignment</CardTitle>
            <CardDescription>Financial and team details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-1">
                Budget
              </h4>
              <p className="text-base text-lg font-semibold">
                {formatCurrency(project.budget)}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-1">
                Assigned To
              </h4>
              <p className="text-base">
                {project.assignedTo || "Not assigned"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Documents Section */}
      <Card id="project-documents">
        <CardHeader>
          <CardTitle>Project Documents</CardTitle>
          <CardDescription>
            Documents uploaded specifically for this project
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingDocs ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No documents uploaded for this project yet.</p>
              {project?.customerId && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => router.push(`/dashboard/customers/${project.customerId}`)}
                >
                  Upload Documents
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Filename</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Uploaded At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.filename}</TableCell>
                    <TableCell>
                      {formatDocType(doc.doc_type)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {doc.uploaded_at
                        ? new Date(doc.uploaded_at).toLocaleString()
                        : "N/A"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <NewProjectDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onProjectCreated={handleProjectUpdated}
        project={project}
      />
    </div>
  );
}
