import { useState, useMemo, useEffect } from "react";
import { Project, ProjectFilters } from "@/types";
import {
  SortingState,
  PaginationState,
  OnChangeFn,
} from "@tanstack/react-table";

const STORAGE_KEY = "crm_projects";

// Load projects from localStorage
function loadProjectsFromStorage(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {
    console.error("Failed to load projects from storage", e);
  }
  return [];
}

// Save projects to localStorage
function saveProjectsToStorage(projects: Project[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error("Failed to save projects to storage", e);
  }
}

interface UseProjectsProps {
  initialProjects?: Project[];
}

export function useProjects({ initialProjects }: UseProjectsProps = {}) {
  // Initialize from localStorage if available, otherwise use provided initialProjects
  const [projectsList, setProjectsList] = useState<Project[]>(() => {
    if (typeof window !== "undefined") {
      const stored = loadProjectsFromStorage();
      if (stored.length > 0) return stored;
    }
    return initialProjects || [];
  });

  // Sync with localStorage whenever projectsList changes
  useEffect(() => {
    saveProjectsToStorage(projectsList);
    // Dispatch custom event for same-tab updates (storage event only fires across tabs)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("crm-projects-updated"));
    }
  }, [projectsList]);
  
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

  const addProject = (project: Project) => {
    setProjectsList((prev) => {
      const updated = [...prev, project];
      saveProjectsToStorage(updated);
      return updated;
    });
  };

  const updateProject = (projectId: string, updates: Partial<Project>) => {
    setProjectsList((prev) => {
      const updated = prev.map((p) => (p.id === projectId ? { ...p, ...updates } : p));
      saveProjectsToStorage(updated);
      return updated;
    });
  };

  const deleteProject = (projectId: string) => {
    setProjectsList((prev) => {
      const updated = prev.filter((p) => p.id !== projectId);
      saveProjectsToStorage(updated);
      return updated;
    });
  };

  // Function to refresh from storage (useful when navigating between pages)
  const refreshFromStorage = () => {
    const stored = loadProjectsFromStorage();
    setProjectsList(stored);
  };

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
    // Refresh from storage
    refreshFromStorage,
  };
}
