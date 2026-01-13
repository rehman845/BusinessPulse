import { apiClient } from "../client";

export interface Resource {
  id: string;
  resource_name: string;
  company_name: string;
  total_hours: number;
  available_hours: number;
  created_at?: string;
  updated_at?: string;
}

export interface ResourceCreate {
  resource_name: string;
  company_name: string;
  total_hours: number;
}

export interface ResourceUpdate {
  resource_name?: string;
  company_name?: string;
  total_hours?: number;
  available_hours?: number;
}

export interface ProjectResourceAssignment {
  id: string;
  project_id: string;
  resource_id: string;
  allocated_hours: number;
  hours_committed: boolean;
  resource_name?: string;
  company_name?: string;
  created_at?: string;
  updated_at?: string;
  resource?: Resource;
}

export interface ProjectResourceAssignmentCreate {
  project_id: string;
  resource_id: string;
  allocated_hours: number;
}

export interface ProjectResourceAssignmentUpdate {
  resource_id?: string;
  allocated_hours?: number;
}

export const resourcesService = {
  // Global resources -----------------
  async getResources(): Promise<Resource[]> {
    const response = await apiClient.get<Resource[]>("/resources");
    const data = response.data;
    return Array.isArray(data) ? data : [];
  },

  async createResource(payload: ResourceCreate): Promise<Resource> {
    const response = await apiClient.post<Resource>("/resources", payload);
    return response.data;
  },

  async updateResource(resourceId: string, payload: ResourceUpdate): Promise<Resource> {
    const response = await apiClient.put<Resource>(`/resources/${resourceId}`, payload);
    return response.data;
  },

  async deleteResource(resourceId: string): Promise<{ deleted: boolean }> {
    const response = await apiClient.delete<{ deleted: boolean }>(`/resources/${resourceId}`);
    return response.data;
  },

  // Project allocations --------------
  async getProjectResources(projectId: string): Promise<ProjectResourceAssignment[]> {
    const response = await apiClient.get<ProjectResourceAssignment[]>(
      `/projects/${projectId}/resources`
    );
    const data = response.data;
    return Array.isArray(data) ? data : [];
  },

  async assignResourceToProject(
    payload: ProjectResourceAssignmentCreate
  ): Promise<ProjectResourceAssignment> {
    const response = await apiClient.post<ProjectResourceAssignment>(
      `/projects/${payload.project_id}/resources`,
      payload
    );
    return response.data;
  },

  async updateProjectResource(
    projectId: string,
    resourceId: string,
    payload: ProjectResourceAssignmentUpdate
  ): Promise<ProjectResourceAssignment> {
    const response = await apiClient.put<ProjectResourceAssignment>(
      `/projects/${projectId}/resources/${resourceId}`,
      payload
    );
    return response.data;
  },

  async deleteProjectResource(
    projectId: string,
    resourceId: string
  ): Promise<{ deleted: boolean }> {
    const response = await apiClient.delete<{ deleted: boolean }>(
      `/projects/${projectId}/resources/${resourceId}`
    );
    return response.data;
  },

  /**
   * Activate resource assignments (deduct hours) when project enters execution
   */
  async activateProjectResources(projectId: string): Promise<{ message: string; activated: number }> {
    const response = await apiClient.post<{ message: string; activated: number }>(
      `/projects/${projectId}/resources/activate`
    );
    return response.data;
  },

  /**
   * Deactivate resource assignments (return hours) when project leaves execution
   */
  async deactivateProjectResources(projectId: string): Promise<{ message: string; deactivated: number }> {
    const response = await apiClient.post<{ message: string; deactivated: number }>(
      `/projects/${projectId}/resources/deactivate`
    );
    return response.data;
  },
};
