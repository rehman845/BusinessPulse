"use client";

import {
  ProjectFilters,
  ProjectStatus,
} from "@/types";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/shared/date-picker-with-range";
import { Search } from "lucide-react";

interface ProjectsFiltersProps {
  filters: ProjectFilters;
  onFiltersChange: (filters: Partial<ProjectFilters>) => void;
}

const STATUS_OPTIONS: { label: string; value: ProjectStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Planning", value: "planning" },
  { label: "In Execution", value: "execution" },
  { label: "On Hold", value: "on_hold" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

export function ProjectsFilters({
  filters,
  onFiltersChange,
}: ProjectsFiltersProps) {
  return (
    <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
      <div className="relative flex-1">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder="Search projects..."
          value={filters.search}
          onChange={(e) => onFiltersChange({ search: e.target.value })}
          className="pl-9"
        />
      </div>
      <div className="flex flex-wrap gap-4">
        <Select
          value={filters.status}
          onValueChange={(value) =>
            onFiltersChange({ status: value as ProjectStatus | "all" })
          }
        >
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DatePickerWithRange
          className="w-full md:w-auto"
          value={{
            from: filters.dateRange.from,
            to: filters.dateRange.to,
          }}
          onChange={(dateRange) =>
            onFiltersChange({
              dateRange: dateRange
                ? { from: dateRange.from, to: dateRange.to }
                : { from: undefined, to: undefined },
            })
          }
        />
      </div>
    </div>
  );
}
