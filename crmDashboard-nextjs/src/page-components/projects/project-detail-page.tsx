"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Project } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Download, Trash, PlayCircle, PauseCircle, CheckCircle, Ban, FileText, Loader2, Upload, Eye, FileQuestion, FileSignature, Users, Plus, CheckSquare, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { statusColors } from "@/components/projects/projects-table-columns";
import { NewProjectDialog } from "@/components/projects/new-project-dialog";
import { useProjects } from "@/hooks";
import {
  documentsService,
  questionnaireService,
  proposalService,
  resourcesService,
  teamService,
  projectsService,
  type Document,
  type DocType,
  type ProjectDocType,
} from "@/api";
import {
  type Resource,
  type ProjectResourceAssignment,
  type ProjectResourceAssignmentCreate,
} from "@/api/services/resources.service";
import {
  type ProjectEmployeeAssignment,
} from "@/api/services/team.service";
import type { Employee } from "@/types";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { formatDocType } from "@/lib/utils";
import { ProjectTasksSection } from "@/components/projects/project-tasks-section";

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
  const searchParams = useSearchParams();
  const { updateProject, deleteProject } = useProjects();
  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<ProjectDocType>("meeting_minutes");
  const [file, setFile] = useState<File | null>(null);
  const [generatingQn, setGeneratingQn] = useState(false);
  const [generatingProposal, setGeneratingProposal] = useState(false);
  
  // Initialize viewMode from URL parameter or default to "details"
  const initialViewMode = searchParams?.get("view") as "details" | "documents" | "resources" | "tasks" | null;
  const [viewMode, setViewMode] = useState<"details" | "documents" | "resources" | "tasks">(
    (initialViewMode && ["details", "documents", "resources", "tasks"].includes(initialViewMode)) 
      ? initialViewMode 
      : "details"
  );
  const [projectResources, setProjectResources] = useState<ProjectResourceAssignment[]>([]);
  const [loadingProjectResources, setLoadingProjectResources] = useState(false);
  const [availableResources, setAvailableResources] = useState<Resource[]>([]);
  const [loadingResourcePool, setLoadingResourcePool] = useState(false);
  const [assigningResource, setAssigningResource] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState<ProjectResourceAssignmentCreate>({
    project_id: projectId,
    resource_id: "",
    allocated_hours: 0,
  });
  const [projectEmployees, setProjectEmployees] = useState<ProjectEmployeeAssignment[]>([]);
  const [loadingProjectEmployees, setLoadingProjectEmployees] = useState(false);
  const [availableEmployees, setAvailableEmployees] = useState<Employee[]>([]);
  const [loadingEmployeePool, setLoadingEmployeePool] = useState(false);
  const [assigningEmployee, setAssigningEmployee] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");

  useEffect(() => {
    setAssignmentForm((prev) => ({ ...prev, project_id: projectId }));
  }, [projectId]);

  // Update viewMode when URL parameter changes
  useEffect(() => {
    const viewParam = searchParams?.get("view");
    if (viewParam && ["details", "documents", "resources", "tasks"].includes(viewParam)) {
      setViewMode(viewParam as "details" | "documents" | "resources" | "tasks");
    }
  }, [searchParams]);

  const loadProjectDocuments = async (customerId: string) => {
    try {
      setLoadingDocs(true);
      // Load only project documents for this project
      const docs = await documentsService.getCustomerDocuments(customerId, projectId, "project");
      setDocuments(docs);
    } catch (error: any) {
      toast.error("Failed to load documents", { description: error.message || "Please try again" });
    } finally {
      setLoadingDocs(false);
    }
  };

  const loadProjectResources = async () => {
    try {
      setLoadingProjectResources(true);
      const res = await resourcesService.getProjectResources(projectId);
      setProjectResources(res);
    } catch (error: any) {
      toast.error("Failed to load project partner companies", { description: error.message || "Please try again" });
    } finally {
      setLoadingProjectResources(false);
    }
  };

  const loadAvailableResources = async () => {
    try {
      setLoadingResourcePool(true);
      const data = await resourcesService.getResources();
      setAvailableResources(data);
    } catch (error: any) {
      toast.error("Failed to load available partner companies", { description: error.message || "Please try again" });
    } finally {
      setLoadingResourcePool(false);
    }
  };

  useEffect(() => {
    const loadProject = async () => {
      try {
        setLoading(true);
        // Load project directly from API
        const loadedProject = await projectsService.getProject(projectId);
        setProject(loadedProject);
        // Load documents, resources, and employees for this project
        if (loadedProject.customerId) {
          loadProjectDocuments(loadedProject.customerId);
        }
        loadProjectResources();
        // Also load employees so they're ready when user clicks "View Partner Companies"
        loadProjectEmployees();
        loadAvailableEmployees();
      } catch (error: any) {
        console.error("Failed to load project:", error);
        toast.error("Project not found. Redirecting to projects list...");
        setTimeout(() => {
          router.push("/dashboard/projects");
        }, 2000);
      } finally {
        setLoading(false);
      }
    };

    loadProject();
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

  const handleProjectUpdated = async (updatedProject: Project) => {
    setProject(updatedProject);
    updateProject(projectId, updatedProject);
    // Refresh employee assignments after project update
    // (in case employees were added/removed during edit)
    if (viewMode === "resources") {
      await Promise.all([loadProjectEmployees(), loadAvailableEmployees()]);
    }
  };

  const handleEdit = () => {
    setEditDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!project) return;
    if (
      typeof window !== "undefined" &&
      window.confirm(
        `Are you sure you want to delete project "${project.projectName}"? This action cannot be undone. All tasks for this project will also be deleted.`
      )
    ) {
      // Delete all tasks for this project first (cascade delete)
      try {
        const { tasksService } = await import("@/api");
        await tasksService.deleteAllProjectTasks(projectId);
      } catch (error) {
        console.warn("Failed to delete project tasks:", error);
        // Continue with deletion even if task deletion fails
      }
      
      deleteProject(projectId);
      toast.success(`Project "${project.projectName}" deleted`);
      router.push("/dashboard/projects");
    }
  };

  const handleStatusChange = async (newStatus: Project["status"]) => {
    if (!project) return;
    const oldStatus = project.status;
    
    // If project is being cancelled or deleted, delete all tasks first
    if (newStatus === "cancelled") {
      try {
        const { tasksService } = await import("@/api");
        await tasksService.deleteAllProjectTasks(projectId);
      } catch (error) {
        console.warn("Failed to delete project tasks:", error);
        // Continue with status change even if task deletion fails
      }
    }
    
    // Update project status
    updateProject(projectId, { status: newStatus });
    setProject({ ...project, status: newStatus });
    
    // Handle resource hour deduction/return based on status change
    try {
      if (oldStatus !== "execution" && newStatus === "execution") {
        // Project entering execution - deduct hours
        const result = await resourcesService.activateProjectResources(projectId);
        toast.success(`Project started. ${result.activated} partner company assignment(s) activated.`);
        // Reload resources to show updated committed status
        await loadProjectResources();
        await loadAvailableResources();
      } else if (oldStatus === "execution" && newStatus !== "execution") {
        // Project leaving execution - return hours
        const result = await resourcesService.deactivateProjectResources(projectId);
        toast.success(`Project status changed. ${result.deactivated} partner company assignment(s) deactivated.`);
        // Reload resources to show updated committed status
        await loadProjectResources();
        await loadAvailableResources();
      } else {
        const statusMessages: Record<Project["status"], string> = {
          planning: "Project set to planning",
          execution: "Project started",
          on_hold: "Project put on hold",
          completed: "Project completed",
          cancelled: "Project cancelled",
        };
        toast.success(statusMessages[newStatus]);
      }
    } catch (error: any) {
      toast.error("Failed to update partner company assignments", { description: error.message || "Please try again" });
    }
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
    // Toggle to documents view
    setViewMode("documents");
    // Load documents if not already loaded
    if (documents.length === 0 && !loadingDocs) {
      loadProjectDocuments(project.customerId);
    }
  };

  const handleViewProjectDetails = () => {
    // Toggle back to details view
    setViewMode("details");
  };

  const handleViewResources = () => {
    setViewMode("resources");
    loadProjectResources();
    loadAvailableResources();
    loadProjectEmployees();
    loadAvailableEmployees();
  };

  const loadProjectEmployees = async () => {
    try {
      setLoadingProjectEmployees(true);
      const employees = await teamService.getProjectEmployees(projectId);
      setProjectEmployees(employees);
    } catch (error: any) {
      toast.error("Failed to load project employees", { description: error.message || "Please try again" });
    } finally {
      setLoadingProjectEmployees(false);
    }
  };

  const loadAvailableEmployees = async () => {
    try {
      setLoadingEmployeePool(true);
      const employees = await teamService.getEmployees(true); // Only active employees
      setAvailableEmployees(employees);
    } catch (error: any) {
      toast.error("Failed to load available employees", { description: error.message || "Please try again" });
    } finally {
      setLoadingEmployeePool(false);
    }
  };

  const handleAssignEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId) {
      toast.error("Please select an employee");
      return;
    }

    try {
      setAssigningEmployee(true);
      await teamService.assignEmployeeToProject(projectId, selectedEmployeeId);
      toast.success("Employee assigned to project");
      setSelectedEmployeeId("");
      await Promise.all([loadProjectEmployees(), loadAvailableEmployees()]);
    } catch (error: any) {
      toast.error("Failed to assign employee", { description: error.message || "Please try again" });
    } finally {
      setAssigningEmployee(false);
    }
  };

  const handleDeleteEmployee = async (assignmentId: string) => {
    if (!window.confirm("Remove this employee from the project?")) {
      return;
    }
    try {
      await teamService.removeEmployeeFromProject(projectId, assignmentId);
      toast.success("Employee removed from project");
      await Promise.all([loadProjectEmployees(), loadAvailableEmployees()]);
    } catch (error: any) {
      toast.error("Failed to remove employee", { description: error.message || "Please try again" });
    }
  };

  const handleAssignResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    if (!assignmentForm.resource_id) {
      toast.error("Please select a partner company");
      return;
    }
    if (assignmentForm.allocated_hours <= 0) {
      toast.error("Allocation hours must be greater than zero");
      return;
    }

    const selected = availableResources.find((res) => res.id === assignmentForm.resource_id);
    if (!selected) {
      toast.error("Selected partner company not found");
      return;
    }
    if (assignmentForm.allocated_hours > selected.available_hours) {
      toast.error("Not enough available hours", {
        description: `Only ${selected.available_hours} hours are available for ${selected.resource_name}`,
      });
      return;
    }

    try {
      setAssigningResource(true);
      await resourcesService.assignResourceToProject(assignmentForm);
      toast.success("Partner company assigned to project");
      setAssignmentForm({
        project_id: projectId,
        resource_id: "",
        allocated_hours: 0,
      });
      await Promise.all([loadProjectResources(), loadAvailableResources()]);
    } catch (error: any) {
      toast.error("Failed to assign partner company", { description: error.message || "Please try again" });
    } finally {
      setAssigningResource(false);
    }
  };

  const handleDeleteResource = async (assignmentId: string) => {
    if (!window.confirm("Remove this partner company from the project?")) {
      return;
    }
    try {
      await resourcesService.deleteProjectResource(projectId, assignmentId);
      toast.success("Partner company removed from project");
      await Promise.all([loadProjectResources(), loadAvailableResources()]);
    } catch (error: any) {
      toast.error("Failed to remove partner company", { description: error.message || "Please try again" });
    }
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !project?.customerId) {
      toast.error("Please select a file to upload");
      return;
    }
    try {
      setUploading(true);
      await documentsService.uploadDocument(project.customerId, docType, "project", file, projectId);
      toast.success("Document uploaded");
      setFile(null);
      const input = document.getElementById("project-doc-file") as HTMLInputElement | null;
      if (input) input.value = "";
      await loadProjectDocuments(project.customerId);
    } catch (error: any) {
      toast.error("Failed to upload document", { description: error.message || "Please try again" });
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateQuestionnaire = async () => {
    if (!project?.customerId) {
      toast.error("Customer ID not found for this project");
      return;
    }
    try {
      setGeneratingQn(true);
      const result = await questionnaireService.generateQuestionnaire(project.customerId, projectId);
      await questionnaireService.downloadQuestionnairePDF(project.customerId, result.questionnaire_id);
      toast.success("Questionnaire generated and downloaded");
      // Reload documents to show the new questionnaire
      await loadProjectDocuments(project.customerId);
    } catch (error: any) {
      toast.error("Failed to generate questionnaire", { description: error.message || "Please try again" });
    } finally {
      setGeneratingQn(false);
    }
  };

  const handleGenerateProposal = async () => {
    if (!project?.customerId) {
      toast.error("Customer ID not found for this project");
      return;
    }
    
    // Check if questionnaire response exists
    const hasQuestionnaireResponse = documents.some(
      (doc) => doc.doc_type === "questionnaire_response"
    );
    
    if (!hasQuestionnaireResponse) {
      toast.error("Questionnaire response required", {
        description: "Please upload a questionnaire response document before generating a proposal. The proposal needs the customer's answers to create an accurate proposal.",
      });
      return;
    }
    
    try {
      setGeneratingProposal(true);
      const result = await proposalService.generateProposal(project.customerId, projectId);
      await proposalService.downloadProposalPDF(project.customerId, result.id);
      toast.success("Proposal generated and downloaded");
      // Reload documents to show the new proposal
      await loadProjectDocuments(project.customerId);
    } catch (error: any) {
      // The backend will also validate, but show the error message
      const errorMessage = error.message || error.detail || "Please try again";
      toast.error("Failed to generate proposal", { description: errorMessage });
    } finally {
      setGeneratingProposal(false);
    }
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
    <div className="flex flex-col gap-6 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/projects")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3 flex-wrap">
              <span className="truncate">{project.projectName}</span>
              <Badge className={`${statusColors[project.status]} shrink-0`}>
                {statusLabels[project.status]}
              </Badge>
            </h1>
            <p className="text-muted-foreground mt-2 truncate">
              {project.projectNumber}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
          {viewMode === "details" && (
            <>
              <Button variant="outline" onClick={handleViewDocuments}>
                <FileText className="mr-2 h-4 w-4" />
                View Documents
              </Button>
              <Button variant="outline" onClick={handleViewResources}>
                <Users className="mr-2 h-4 w-4" />
                View Partner Companies
              </Button>
              <Button variant="outline" onClick={() => setViewMode("tasks")}>
                <CheckSquare className="mr-2 h-4 w-4" />
                View Tasks
              </Button>
            </>
          )}
          {viewMode === "documents" && (
            <Button variant="outline" onClick={handleViewProjectDetails}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Project Details
            </Button>
          )}
          {viewMode === "resources" && (
            <Button variant="outline" onClick={handleViewProjectDetails}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Project Details
            </Button>
          )}
          {viewMode === "tasks" && (
            <Button variant="outline" onClick={handleViewProjectDetails}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Project Details
            </Button>
          )}
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

      {/* Conditional Rendering Based on View Mode */}
      {viewMode === "details" ? (
        /* Main Content Grid - Project Details View */
        <div className="grid gap-6 md:grid-cols-2 w-full max-w-full">
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
      ) : viewMode === "documents" ? (
        /* Documents View - Shows Documents, Questionnaire & Proposal Generators */
        <div className="space-y-6 w-full max-w-full overflow-x-hidden">
          {/* Documents Section */}
          <Card>
        <CardHeader>
          <CardTitle>Project Documents</CardTitle>
          <CardDescription>
            Documents uploaded specifically for this project (meeting minutes, requirements, proposals, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload Form */}
          {project?.customerId && (
            <form onSubmit={handleUpload} className="space-y-3 p-4 border rounded-lg bg-muted/50">
              <div className="flex gap-3">
                <Select value={docType} onValueChange={(v) => setDocType(v as ProjectDocType)}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meeting_minutes">Meeting Minutes</SelectItem>
                    <SelectItem value="requirements">Requirements</SelectItem>
                    <SelectItem value="questionnaire">Questionnaire</SelectItem>
                    <SelectItem value="questionnaire_response">Questionnaire Response</SelectItem>
                    <SelectItem value="proposal">Proposal</SelectItem>
                    <SelectItem value="design_sdd">Design (SDD)</SelectItem>
                    <SelectItem value="kickoff_meeting">Kickoff Meeting</SelectItem>
                    <SelectItem value="instruction_manual">Instruction Manual</SelectItem>
                    <SelectItem value="maintenance_doc">Maintenance Doc</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  id="project-doc-file"
                  type="file"
                  onChange={handleFileChange}
                  className="flex-1"
                  disabled={uploading}
                />
                <Button type="submit" disabled={uploading || !file}>
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* Documents Table */}
          {loadingDocs ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No documents uploaded for this project yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Filename</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Uploaded At</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.filename}</TableCell>
                    <TableCell>{formatDocType(doc.doc_type)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {doc.uploaded_at
                        ? new Date(doc.uploaded_at).toLocaleString()
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {(doc.filename.endsWith(".pdf") ||
                          doc.filename.endsWith(".docx") ||
                          doc.filename.endsWith(".doc")) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (project?.customerId) {
                                documentsService.viewDocument(project.customerId, doc.id).catch((err) => {
                                  toast.error("Failed to view document", { description: err.message });
                                });
                              }
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (project?.customerId) {
                              documentsService.downloadDocument(project.customerId, doc.id, doc).catch((err) => {
                                toast.error("Failed to download document", { description: err.message });
                              });
                            }
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (project?.customerId && window.confirm(`Are you sure you want to delete "${doc.filename}"?`)) {
                              documentsService.deleteDocument(project.customerId, doc.id).then(() => {
                                toast.success("Document deleted");
                                if (project?.customerId) {
                                  loadProjectDocuments(project.customerId);
                                }
                              }).catch((err) => {
                                toast.error("Failed to delete document", { description: err.message });
                              });
                            }
                          }}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

          {/* Questionnaire & Proposal Generation */}
          {project?.customerId && (
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Questionnaire</CardTitle>
                  <CardDescription>
                    Generate an engineering-focused clarification questionnaire using the project documents.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button onClick={handleGenerateQuestionnaire} disabled={generatingQn}>
                    {generatingQn ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <FileQuestion className="mr-2 h-4 w-4" />
                        Generate Questionnaire
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    The questionnaire is generated using all project documents. It will be saved as a project document and automatically downloaded.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Proposal</CardTitle>
                  <CardDescription>
                    Generate a proposal based on all project documents, including questionnaire responses.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    onClick={handleGenerateProposal} 
                    disabled={generatingProposal || !documents.some(doc => doc.doc_type === "questionnaire_response")} 
                    variant="outline"
                  >
                    {generatingProposal ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <FileSignature className="mr-2 h-4 w-4" />
                        Generate Proposal
                      </>
                    )}
                  </Button>
                  {!documents.some(doc => doc.doc_type === "questionnaire_response") ? (
                    <p className="text-xs text-amber-600 dark:text-amber-500 font-medium">
                      ⚠️ Questionnaire response required. Please upload a questionnaire response document before generating a proposal.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      The proposal will use all project documents: requirements, meeting minutes, questionnaires, and questionnaire responses. It will be saved as a project document and automatically downloaded.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      ) : viewMode === "resources" ? (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Partner Company Pool
                    </CardTitle>
                    <CardDescription>
                      Global pool of partner companies and available hours
                    </CardDescription>
                  </div>
                  <Button variant="outline" onClick={() => loadAvailableResources()}>
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingResourcePool ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : availableResources.length === 0 ? (
                  <div className="rounded-md border border-dashed p-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      No partner companies in the pool yet. Use the new Partner Companies tab in the sidebar to add them.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead className="text-right">Total Hours</TableHead>
                          <TableHead className="text-right">Available</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {availableResources.map((resource) => (
                          <TableRow key={resource.id}>
                            <TableCell className="font-medium">{resource.resource_name}</TableCell>
                            <TableCell>{resource.company_name}</TableCell>
                            <TableCell className="text-right">{resource.total_hours}</TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant={resource.available_hours > 0 ? "secondary" : "outline"}
                                className="font-mono"
                              >
                                {resource.available_hours} hrs
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold">Assign partner company to this project</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Partner companies can be assigned at any time. Hours will be deducted when project enters execution.
                    </p>
                  </div>
                  <form onSubmit={handleAssignResource} className="space-y-3">
                    <div className="grid gap-3">
                      <div className="grid md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm font-medium mb-1 block">Partner Company</label>
                          <Select
                            value={assignmentForm.resource_id}
                            onValueChange={(value) =>
                              setAssignmentForm((prev) => ({ ...prev, resource_id: value }))
                            }
                            disabled={availableResources.length === 0}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select partner company" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableResources
                                .filter((res) => res.available_hours > 0)
                                .map((res) => (
                                  <SelectItem key={res.id} value={res.id}>
                                    {res.resource_name} • {res.available_hours} hrs available
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1 block">Hours to allocate</label>
                          <Input
                            type="number"
                            min="1"
                            value={assignmentForm.allocated_hours || ""}
                            onChange={(e) =>
                              setAssignmentForm((prev) => ({
                                ...prev,
                                allocated_hours: parseInt(e.target.value, 10) || 0,
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={assigningResource || availableResources.length === 0}
                      >
                        {assigningResource ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Assigning...
                          </>
                        ) : (
                          <>
                            <Plus className="mr-2 h-4 w-4" />
                            Assign to Project
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Project Assignments</CardTitle>
                <CardDescription>
                  Partner companies currently dedicated to this project with allotted hours
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingProjectResources ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : projectResources.length === 0 ? (
                  <div className="rounded-md border border-dashed p-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      No partner companies assigned yet. Use the form to assign available partner companies.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Partner Company</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead className="text-right">Hours Allocated</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projectResources.map((resource) => (
                          <TableRow key={resource.id}>
                            <TableCell className="font-medium">
                              {resource.resource?.resource_name || resource.resource_name || "Partner Company"}
                            </TableCell>
                            <TableCell>{resource.resource?.company_name || resource.company_name || "N/A"}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Badge variant="outline" className="font-mono">
                                  {resource.allocated_hours} hrs
                                </Badge>
                                {resource.hours_committed ? (
                                  <Badge variant="default" className="text-xs">
                                    Active
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">
                                    Reserved
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteResource(resource.id)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Employee Assignments Section */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <UserPlus className="h-5 w-5" />
                      Employee Pool
                    </CardTitle>
                    <CardDescription>
                      Available company employees to assign to this project
                    </CardDescription>
                  </div>
                  <Button variant="outline" onClick={() => loadAvailableEmployees()}>
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingEmployeePool ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : availableEmployees.filter((emp) => !projectEmployees.some((pe) => pe.employee_id === emp.id)).length === 0 ? (
                  <div className="rounded-md border border-dashed p-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      No employees available. Use the Team tab in the sidebar to add employees.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead className="text-right">Hourly Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {availableEmployees
                          .filter((emp) => !projectEmployees.some((pe) => pe.employee_id === emp.id))
                          .map((employee) => (
                            <TableRow key={employee.id}>
                              <TableCell className="font-medium">{employee.full_name}</TableCell>
                              <TableCell>{employee.role}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant="outline" className="font-mono">
                                  ${employee.hourly_rate.toFixed(2)}/hr
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold">Assign employee to this project</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Select an employee to assign them to work on this project.
                    </p>
                  </div>
                  <form onSubmit={handleAssignEmployee} className="space-y-3">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Employee</label>
                      <Select
                        value={selectedEmployeeId}
                        onValueChange={setSelectedEmployeeId}
                        disabled={availableEmployees.filter((emp) => !projectEmployees.some((pe) => pe.employee_id === emp.id)).length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableEmployees
                            .filter((emp) => !projectEmployees.some((pe) => pe.employee_id === emp.id))
                            .map((emp) => (
                              <SelectItem key={emp.id} value={emp.id}>
                                {emp.full_name} • {emp.role} • ${emp.hourly_rate.toFixed(2)}/hr
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={assigningEmployee || !selectedEmployeeId || availableEmployees.filter((emp) => !projectEmployees.some((pe) => pe.employee_id === emp.id)).length === 0}
                      >
                        {assigningEmployee ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Assigning...
                          </>
                        ) : (
                          <>
                            <Plus className="mr-2 h-4 w-4" />
                            Assign to Project
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Employee Assignments</CardTitle>
                <CardDescription>
                  Employees currently assigned to this project
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingProjectEmployees ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : projectEmployees.length === 0 ? (
                  <div className="rounded-md border border-dashed p-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      No employees assigned yet. Use the form to assign available employees.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead className="text-right">Hourly Rate</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projectEmployees.map((assignment) => (
                          <TableRow key={assignment.id}>
                            <TableCell className="font-medium">
                              {assignment.employee?.full_name || "Employee"}
                            </TableCell>
                            <TableCell>{assignment.employee?.role || "N/A"}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline" className="font-mono">
                                ${assignment.employee?.hourly_rate.toFixed(2) || "0.00"}/hr
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteEmployee(assignment.id)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : viewMode === "tasks" ? (
        <ProjectTasksSection projectId={projectId} />
      ) : null}

      {/* Edit Dialog */}
      <NewProjectDialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          // When dialog closes after edit, refresh employee assignments
          if (!open && project) {
            loadProjectEmployees();
            loadAvailableEmployees();
          }
        }}
        onProjectCreated={handleProjectUpdated}
        project={project}
      />
    </div>
  );
}
