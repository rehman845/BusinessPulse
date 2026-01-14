export type TaskStatus = 'Todo' | 'In Progress' | 'Done' | 'Blocked';

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  due_date?: string;
  notion_page_id?: string;
  created_at?: string;
  updated_at?: string;
  last_synced_at?: string;
}

export interface TaskCreate {
  title: string;
  description?: string;
  status?: TaskStatus;
  due_date?: string;
}

export interface TaskUpdate {
  title?: string;
  description?: string;
  due_date?: string;
}

export interface TaskFilters {
  status?: TaskStatus | 'all';
  due_before?: string;
  overdue?: boolean;
}

