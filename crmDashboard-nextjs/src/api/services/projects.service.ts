/**
 * Projects Service
 * Handles all project-related API calls
 */

import { apiClient } from "../client";
import type { Project, ProjectFilters } from "@/types";

export interface CreateProjectData {
  projectName: string;
  customerId: string;
  customerName: string;
  email: string;
  startDate: string;
  endDate?: string;
  budget?: number;
  description?: string;
  assignedTo?: string;
  status?: Project["status"];
}

export interface UpdateProjectData {
  projectName?: string;
  status?: Project["status"];
  startDate?: string;
  endDate?: string;
  budget?: number;
  description?: string;
  assignedTo?: string;
}

export const projectsService = {
  /**
   * Get all projects
   */
  async getProjects(filters?: ProjectFilters) {
    return apiClient.get<Project[]>("/projects", filters as any);
  },

  /**
   * Get single project by ID
   */
  async getProject(id: string) {
    return apiClient.get<Project>(`/projects/${id}`);
  },

  /**
   * Create new project
   */
  async createProject(data: CreateProjectData) {
    return apiClient.post<Project>("/projects", data);
  },

  /**
   * Update project
   */
  async updateProject(id: string, data: UpdateProjectData) {
    return apiClient.patch<Project>(`/projects/${id}`, data);
  },

  /**
   * Delete project
   */
  async deleteProject(id: string) {
    return apiClient.delete(`/projects/${id}`);
  },

  /**
   * Cancel project
   */
  async cancelProject(id: string) {
    return apiClient.post(`/projects/${id}/cancel`);
  },

  /**
   * Start project
   */
  async startProject(id: string) {
    return apiClient.post(`/projects/${id}/start`);
  },

  /**
   * Put project on hold
   */
  async putOnHold(id: string) {
    return apiClient.post(`/projects/${id}/hold`);
  },

  /**
   * Complete project
   */
  async completeProject(id: string) {
    return apiClient.post(`/projects/${id}/complete`);
  },

  /**
   * Get project statistics
   */
  async getProjectStats() {
    return apiClient.get<{
      total: number;
      planning: number;
      execution: number;
      onHold: number;
      completed: number;
      cancelled: number;
    }>("/projects/stats");
  },
};
