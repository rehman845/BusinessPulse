import { useState, useMemo, useEffect, useCallback } from "react";
import { Project, ProjectFilters } from "@/types";
import {
  SortingState,
  PaginationState,
  OnChangeFn,
} from "@tanstack/react-table";
import { projectsService } from "@/api/services/projects.service";
import { toast } from "sonner";

interface UseProjectsProps {
  initialProjects?: Project[];
}

export function useProjects({ initialProjects }: UseProjectsProps = {}) {
  const [projectsList, setProjectsList] = useState<Project[]>(initialProjects || []);
  const [loading, setLoading] = useState(true);

  // Load projects from API
  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      const projects = await projectsService.getProjects();
      setProjectsList(projects);
    } catch (error: any) {
      toast.error("Failed to load projects", {
        description: error.message || "Please try again",
      });
      console.error("Failed to load projects:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);
  
  const [filters, setFilters] = useState<ProjectFilters>({
    status: "all",
    search: "",
    dateRange: {
      from: undefined,
      to: undefined,
    },
  });

  const [sorting, setSorting] = useState<SortingState>([
    { id: "startDate", desc: true },
  ]);

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const filteredProjects = useMemo(() => {
    return projectsList.filter((project) => {
      // Status filter
      if (filters.status !== "all" && project.status !== filters.status) {
        return false;
      }

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const searchableFields = [
          project.projectNumber,
          project.projectName,
          project.customerName,
          project.email,
          project.description || "",
        ].map((field) => field.toLowerCase());

        if (!searchableFields.some((field) => field.includes(searchLower))) {
          return false;
        }
      }

      // Date range filter (check startDate)
      if (filters.dateRange?.from || filters.dateRange?.to) {
        const projectDate = new Date(project.startDate);
        if (filters.dateRange.from && projectDate < filters.dateRange.from) {
          return false;
        }
        if (filters.dateRange.to && projectDate > filters.dateRange.to) {
          return false;
        }
      }

      return true;
    });
  }, [projectsList, filters]);

  // For TanStack table, we need to handle pagination and sorting separately
  const paginatedAndSortedProjects = useMemo(() => {
    // Early return if no filters
    if (filteredProjects.length === 0) return [];

    // Skip sorting if no sort criteria
    if (sorting.length === 0) {
      // Just apply pagination
      const startIdx = pagination.pageIndex * pagination.pageSize;
      const endIdx = startIdx + pagination.pageSize;
      return filteredProjects.slice(startIdx, endIdx);
    }

    // Create a sorting function that makes comparisons based on field type
    const compareValues = (
      a: number | string | Date | undefined,
      b: number | string | Date | undefined,
      desc: boolean
    ): number => {
      const direction = desc ? -1 : 1;

      // Handle different value types
      if (a === b) return 0;

      // Handle null/undefined values
      if (a == null) return direction;
      if (b == null) return -direction;

      // Check if values are dates (try to detect ISO strings)
      if (typeof a === "string" && typeof b === "string") {
        // ISO date format detection (more reliable than checking for "T")
        const isDateA = /^\d{4}-\d{2}-\d{2}(T|\s)/.test(a);
        const isDateB = /^\d{4}-\d{2}-\d{2}(T|\s)/.test(b);

        if (isDateA && isDateB) {
          const dateA = new Date(a).getTime();
          const dateB = new Date(b).getTime();
          return (dateA - dateB) * direction;
        }

        // Regular string comparison
        return a.localeCompare(b) * direction;
      }

      // Number comparison
      if (typeof a === "number" && typeof b === "number") {
        return (a - b) * direction;
      }

      // Default comparison (converts to string)
      return String(a).localeCompare(String(b)) * direction;
    };

    // Apply sorting
    const sortedProjects = [...filteredProjects].sort((a, b) => {
      // Handle multi-sorting using sortingState array
      for (const sort of sorting) {
        const key = sort.id as keyof Project;
        const compared = compareValues(a[key], b[key], sort.desc);
        if (compared !== 0) return compared;
      }
      return 0;
    });

    // Apply pagination
    const startIdx = pagination.pageIndex * pagination.pageSize;
    const endIdx = startIdx + pagination.pageSize;
    return sortedProjects.slice(startIdx, endIdx);
  }, [filteredProjects, sorting, pagination]);

  const updateFilters = (newFilters: Partial<ProjectFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    // Reset to first page when filters change
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const handleSortingChange: OnChangeFn<SortingState> = (updaterOrValue) => {
    setSorting(
      updaterOrValue instanceof Function
        ? updaterOrValue(sorting)
        : updaterOrValue
    );
  };

  const handlePaginationChange: OnChangeFn<PaginationState> = (
    updaterOrValue
  ) => {
    setPagination(
      updaterOrValue instanceof Function
        ? updaterOrValue(pagination)
        : updaterOrValue
    );
  };

  const handleClearFilters = () => {
    setFilters({
      status: "all",
      search: "",
      dateRange: { from: undefined, to: undefined },
    });
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const addProject = async (project: Project) => {
    try {
      // Project should already be created via API before this is called
      // Just add it to the local state
      setProjectsList((prev) => [...prev, project]);
    } catch (error: any) {
      toast.error("Failed to add project", { description: error.message });
      throw error;
    }
  };

  const updateProject = async (projectId: string, updates: Partial<Project>) => {
    try {
      const updatedProject = await projectsService.updateProject(projectId, {
        projectNumber: updates.projectNumber,
        projectName: updates.projectName,
        customerId: updates.customerId,
        customerName: updates.customerName,
        email: updates.email,
        status: updates.status,
        startDate: updates.startDate,
        endDate: updates.endDate,
        budget: updates.budget,
        description: updates.description,
        assignedTo: updates.assignedTo,
      });
      setProjectsList((prev) => prev.map((p) => (p.id === projectId ? updatedProject : p)));
      toast.success("Project updated");
    } catch (error: any) {
      toast.error("Failed to update project", { description: error.message });
      throw error;
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      // Delete all tasks for this project from backend (cascade delete)
      try {
        const { tasksService } = await import("@/api");
        await tasksService.deleteAllProjectTasks(projectId);
      } catch (error) {
        // Log but don't fail - tasks might not exist or backend might be unavailable
        console.warn("Failed to delete project tasks:", error);
      }

      // Delete project from API
      await projectsService.deleteProject(projectId);
      setProjectsList((prev) => prev.filter((p) => p.id !== projectId));
      toast.success("Project deleted");
    } catch (error: any) {
      toast.error("Failed to delete project", { description: error.message });
      throw error;
    }
  };

  // Function to refresh from API
  const refreshFromStorage = loadProjects;

  return {
    // Raw filtered projects (no pagination applied)
    allProjects: filteredProjects,
    // Projects with pagination and sorting applied
    projects: paginatedAndSortedProjects,
    // Total count for pagination
    pageCount: Math.ceil(filteredProjects.length / pagination.pageSize),
    // States
    filters,
    sorting,
    pagination,
    loading,
    // Update handlers
    updateFilters,
    handleSortingChange,
    handlePaginationChange,
    handleClearFilters,
    // Project management
    addProject,
    updateProject,
    deleteProject,
    // All projects (unfiltered)
    allProjectsList: projectsList,
    // Refresh from API
    refreshFromStorage,
    // Reload function
    loadProjects,
  };
}
