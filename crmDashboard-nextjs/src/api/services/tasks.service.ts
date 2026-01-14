/**
 * Tasks Service
 * Handles all task-related API calls
 */

import { apiClient } from "../client";
import type { Task, TaskCreate, TaskUpdate, TaskFilters } from "@/types/task";

export const tasksService = {
  /**
   * Get all tasks for a project
   */
  async getProjectTasks(projectId: string) {
    const response = await apiClient.get<Task[]>(`/projects/${projectId}/tasks`);
    return response.data;
  },

  /**
   * Create a new task
   */
  async createTask(projectId: string, data: TaskCreate) {
    const response = await apiClient.post<Task>(`/projects/${projectId}/tasks`, data);
    return response.data;
  },

  /**
   * Update task fields
   */
  async updateTask(taskId: string, data: TaskUpdate) {
    const response = await apiClient.put<Task>(`/tasks/${taskId}`, data);
    return response.data;
  },

  /**
   * Update task status
   */
  async updateTaskStatus(taskId: string, status: Task["status"]) {
    const response = await apiClient.patch<Task>(`/tasks/${taskId}/status`, { status });
    return response.data;
  },

  /**
   * Get all tasks (global view with filters)
   */
  async getAllTasks(filters?: TaskFilters) {
    const params: Record<string, string> = {};
    if (filters?.status && filters.status !== 'all') {
      params.status = filters.status;
    }
    if (filters?.due_before) {
      params.due_before = filters.due_before;
    }
    if (filters?.overdue) {
      params.overdue = 'true';
    }
    const response = await apiClient.get<Task[]>("/notion/tasks", params);
    return response.data;
  },

  /**
   * Sync tasks from Notion for a project
   */
  async syncProjectTasks(projectId: string) {
    const response = await apiClient.post<{
      message: string;
      created: number;
      updated: number;
      total: number;
    }>(`/projects/${projectId}/notion/sync`);
    return response.data;
  },

  /**
   * Get task counts by project
   */
  async getTaskCountsByProject() {
    const response = await apiClient.get<Record<string, {
      total: number;
      todo: number;
      in_progress: number;
      done: number;
      blocked: number;
      pending: number;
    }>>("/projects/tasks/counts");
    return response.data;
  },

  /**
   * Delete a task
   */
  async deleteTask(taskId: string) {
    const response = await apiClient.delete<{
      message: string;
      deleted: boolean;
    }>(`/tasks/${taskId}`);
    return response.data;
  },

  /**
   * Delete all tasks for a project (cascade delete)
   */
  async deleteAllProjectTasks(projectId: string) {
    const response = await apiClient.delete<{
      message: string;
      deleted_count: number;
    }>(`/projects/${projectId}/tasks`);
    return response.data;
  },

  /**
   * Sync all tasks from Notion (global sync)
   */
  async syncAllTasks(filters?: TaskFilters) {
    const params: Record<string, string> = {};
    if (filters?.status && filters.status !== 'all') {
      params.status = filters.status;
    }
    if (filters?.due_before) {
      params.due_before = filters.due_before;
    }
    if (filters?.overdue) {
      params.overdue = 'true';
    }
    // Use POST to /notion/tasks with query params
    const queryString = Object.keys(params).length > 0
      ? "?" + new URLSearchParams(params).toString()
      : "";
    const response = await apiClient.post<{
      message: string;
      created: number;
      updated: number;
      total: number;
    }>(`/notion/tasks${queryString}`);
    return response.data;
  },
};

