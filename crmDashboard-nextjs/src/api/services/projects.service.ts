/**
 * Projects Service
 * Handles all project-related API calls
 * Converts between frontend (camelCase) and backend (snake_case) formats
 */

import { apiClient } from "../client";
import type { Project, ProjectFilters } from "@/types";

// Backend format (snake_case)
interface BackendProject {
  id: string;
  project_number: string;
  project_name: string;
  customer_id: string;
  customer_name: string;
  email: string;
  status: string;
  start_date: string;
  end_date?: string | null;
  budget?: number | null;
  description?: string | null;
  assigned_to?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateProjectData {
  projectNumber: string;
  projectName: string;
  customerId: string;
  customerName: string;
  email: string;
  status?: Project["status"];
  startDate: string;
  endDate?: string;
  budget?: number;
  description?: string;
  assignedTo?: string;
}

export interface UpdateProjectData {
  projectNumber?: string;
  projectName?: string;
  customerId?: string;
  customerName?: string;
  email?: string;
  status?: Project["status"];
  startDate?: string;
  endDate?: string;
  budget?: number;
  description?: string;
  assignedTo?: string;
}

/**
 * Convert backend project (snake_case) to frontend format (camelCase)
 */
function backendToFrontend(backend: BackendProject): Project {
  return {
    id: backend.id,
    projectNumber: backend.project_number,
    projectName: backend.project_name,
    customerId: backend.customer_id,
    customerName: backend.customer_name,
    email: backend.email,
    status: backend.status as Project["status"],
    startDate: backend.start_date,
    endDate: backend.end_date || undefined,
    budget: backend.budget || undefined,
    description: backend.description || undefined,
    assignedTo: backend.assigned_to || undefined,
  };
}

/**
 * Convert frontend project data (camelCase) to backend format (snake_case)
 */
function frontendToBackend(data: CreateProjectData | UpdateProjectData): any {
  const backend: any = {};
  if ("projectNumber" in data && data.projectNumber !== undefined) backend.project_number = data.projectNumber;
  if ("projectName" in data && data.projectName !== undefined) backend.project_name = data.projectName;
  if ("customerId" in data && data.customerId !== undefined) backend.customer_id = data.customerId;
  if ("customerName" in data && data.customerName !== undefined) backend.customer_name = data.customerName;
  if ("email" in data && data.email !== undefined) backend.email = data.email;
  if ("status" in data && data.status !== undefined) backend.status = data.status;
  if ("startDate" in data && data.startDate !== undefined) backend.start_date = data.startDate;
  if ("endDate" in data && data.endDate !== undefined) backend.end_date = data.endDate;
  if ("budget" in data && data.budget !== undefined) backend.budget = data.budget;
  if ("description" in data && data.description !== undefined) backend.description = data.description;
  if ("assignedTo" in data && data.assignedTo !== undefined) backend.assigned_to = data.assignedTo;
  return backend;
}

export const projectsService = {
  /**
   * Get all projects
   */
  async getProjects(): Promise<Project[]> {
    const response = await apiClient.get<BackendProject[]>("/projects");
    const data = Array.isArray(response.data) ? response.data : [];
    return data.map(backendToFrontend);
  },

  /**
   * Get single project by ID
   */
  async getProject(id: string): Promise<Project> {
    const response = await apiClient.get<BackendProject>(`/projects/${id}`);
    return backendToFrontend(response.data);
  },

  /**
   * Create new project
   */
  async createProject(data: CreateProjectData): Promise<Project> {
    const backendData = frontendToBackend(data);
    const response = await apiClient.post<BackendProject>("/projects", backendData);
    return backendToFrontend(response.data);
  },

  /**
   * Update project
   */
  async updateProject(id: string, data: UpdateProjectData): Promise<Project> {
    const backendData = frontendToBackend(data);
    const response = await apiClient.put<BackendProject>(`/projects/${id}`, backendData);
    return backendToFrontend(response.data);
  },

  /**
   * Delete project
   */
  async deleteProject(id: string): Promise<{ deleted: boolean }> {
    const response = await apiClient.delete<{ deleted: boolean }>(`/projects/${id}`);
    return response.data;
  },
};
