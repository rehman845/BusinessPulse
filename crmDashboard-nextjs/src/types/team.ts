/**
 * Team/Employee Types
 */

export interface Employee {
  id: string;
  full_name: string;
  role: string;
  hourly_rate: number;
  hours_per_day: number;
  days_per_week: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface EmployeeCreate {
  full_name: string;
  role: string;
  hourly_rate: number;
  hours_per_day?: number;
  days_per_week?: number;
  is_active?: boolean;
}

export interface EmployeeUpdate {
  full_name?: string;
  role?: string;
  hourly_rate?: number;
  hours_per_day?: number;
  days_per_week?: number;
  is_active?: boolean;
}

export interface TimeEntry {
  id: string;
  employee_id: string;
  project_id: string;
  work_date?: string;
  hours: number;
  description?: string;
  created_at?: string;
  employee?: Employee;
}
