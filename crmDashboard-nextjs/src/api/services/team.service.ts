/**
 * Team Service
 * Handles all team/employee-related API calls
 */

import { apiClient } from "../client";
import type { Employee, EmployeeCreate, EmployeeUpdate, TimeEntry } from "@/types";

export const teamService = {
  async getEmployees(isActive?: boolean): Promise<Employee[]> {
    const params = isActive !== undefined ? { is_active: isActive.toString() } : {};
    const response = await apiClient.get<Employee[]>("/team/employees", params);
    return Array.isArray(response.data) ? response.data : [];
  },

  async getEmployee(employeeId: string): Promise<Employee> {
    const response = await apiClient.get<Employee>(`/team/employees/${employeeId}`);
    return response.data;
  },

  async createEmployee(payload: EmployeeCreate): Promise<Employee> {
    const response = await apiClient.post<Employee>("/team/employees", payload);
    return response.data;
  },

  async updateEmployee(employeeId: string, payload: EmployeeUpdate): Promise<Employee> {
    const response = await apiClient.patch<Employee>(`/team/employees/${employeeId}`, payload);
    return response.data;
  },

  async deleteEmployee(employeeId: string): Promise<{ deleted: boolean }> {
    const response = await apiClient.delete<{ deleted: boolean }>(`/team/employees/${employeeId}`);
    return response.data;
  },

  async getEmployeeTimeEntries(employeeId: string, projectId?: string): Promise<TimeEntry[]> {
    const params: Record<string, string> = { employee_id: employeeId };
    if (projectId) params.project_id = projectId;
    const response = await apiClient.get<TimeEntry[]>("/team/time-entries", params);
    return Array.isArray(response.data) ? response.data : [];
  },

  // Project employee assignments
  async getProjectEmployees(projectId: string): Promise<ProjectEmployeeAssignment[]> {
    const response = await apiClient.get<ProjectEmployeeAssignment[]>(
      `/projects/${projectId}/employees`
    );
    return Array.isArray(response.data) ? response.data : [];
  },

  async assignEmployeeToProject(
    projectId: string,
    employeeId: string
  ): Promise<ProjectEmployeeAssignment> {
    const response = await apiClient.post<ProjectEmployeeAssignment>(
      `/projects/${projectId}/employees`,
      { project_id: projectId, employee_id: employeeId }
    );
    return response.data;
  },

  async removeEmployeeFromProject(
    projectId: string,
    assignmentId: string
  ): Promise<{ deleted: boolean }> {
    const response = await apiClient.delete<{ deleted: boolean }>(
      `/projects/${projectId}/employees/${assignmentId}`
    );
    return response.data;
  },
};

export interface ProjectEmployeeAssignment {
  id: string;
  project_id: string;
  employee_id: string;
  created_at?: string;
  updated_at?: string;
  employee?: Employee;
}
