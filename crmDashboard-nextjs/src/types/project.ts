export type ProjectStatus = 'planning' | 'execution' | 'on_hold' | 'completed' | 'cancelled';

export interface Project {
  id: string;
  projectNumber: string;
  projectName: string;
  customerName: string;
  customerId?: string;
  email: string;
  status: ProjectStatus;
  startDate: string;
  endDate?: string;
  budget?: number;
  description?: string;
  assignedTo?: string;
}

export interface ProjectFilters {
  status: ProjectStatus | 'all';
  search: string;
  dateRange: {
    from: Date | undefined;
    to: Date | undefined;
  };
}
