"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, Loader2, Calendar } from "lucide-react";
import { tasksService } from "@/api";
import type { Task, TaskFilters } from "@/types";
import { toast } from "sonner";
import { format } from "date-fns";
import { useProjects } from "@/hooks";

export function TasksPage() {
  const { allProjectsList } = useProjects();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [filters, setFilters] = useState<TaskFilters>({
    status: "all",
    overdue: false,
  });

  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await tasksService.getAllTasks(filters);
      setTasks(data);
    } catch (error: any) {
      toast.error("Failed to load tasks", { description: error.message || "Please try again" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
    // Auto-refresh every 60 seconds
    const interval = setInterval(loadTasks, 60000);
    return () => clearInterval(interval);
  }, [filters]);

  const handleSync = async () => {
    try {
      setSyncing(true);
      const result = await tasksService.syncAllTasks(filters);
      toast.success(result.message || "Tasks synced successfully", {
        description: `Created: ${result.created}, Updated: ${result.updated}`,
      });
      await loadTasks();
    } catch (error: any) {
      toast.error("Failed to sync tasks", { description: error.message || "Please try again" });
    } finally {
      setSyncing(false);
    }
  };

  const getProjectName = (projectId: string) => {
    const project = allProjectsList.find((p) => p.id === projectId);
    return project?.projectName || projectId;
  };

  const overdueTasks = tasks.filter(
    (task) =>
      task.due_date &&
      new Date(task.due_date) < new Date() &&
      task.status !== "Done"
  );

  const dueTodayTasks = tasks.filter(
    (task) =>
      task.due_date &&
      format(new Date(task.due_date), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")
  );

  const stats = [
    {
      title: "Total Tasks",
      value: tasks.length,
    },
    {
      title: "Overdue",
      value: overdueTasks.length,
      color: "text-red-600 dark:text-red-400",
    },
    {
      title: "Due Today",
      value: dueTodayTasks.length,
      color: "text-orange-600 dark:text-orange-400",
    },
    {
      title: "In Progress",
      value: tasks.filter((t) => t.status === "In Progress").length,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground mt-2">
            View and manage tasks across all projects
          </p>
        </div>
        <Button onClick={handleSync} disabled={syncing}>
          {syncing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync from Notion
            </>
          )}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stat.color || ""}`}>{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter tasks by status or due date</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select
                value={filters.status || "all"}
                onValueChange={(value) =>
                  setFilters({ ...filters, status: value === "all" ? undefined : (value as Task["status"]) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Todo">Todo</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Done">Done</SelectItem>
                  <SelectItem value="Blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant={filters.overdue ? "default" : "outline"}
                onClick={() => setFilters({ ...filters, overdue: !filters.overdue })}
              >
                Show Overdue Only
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Tasks</CardTitle>
          <CardDescription>
            Tasks from all projects {filters.overdue && "(Overdue only)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-muted-foreground">No tasks found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => {
                  const isOverdue =
                    task.due_date &&
                    new Date(task.due_date) < new Date() &&
                    task.status !== "Done";
                  
                  return (
                    <TableRow key={task.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{task.title}</div>
                          {task.description && (
                            <div className="text-sm text-muted-foreground mt-1">
                              {task.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getProjectName(task.project_id)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            task.status === "Todo"
                              ? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                              : task.status === "In Progress"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                              : task.status === "Done"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                          }
                        >
                          {task.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {task.due_date ? (
                          <div className={`flex items-center gap-1 text-sm ${isOverdue ? "text-red-600 dark:text-red-400 font-medium" : ""}`}>
                            <Calendar className="h-4 w-4" />
                            {format(new Date(task.due_date), "MMM d, yyyy")}
                            {isOverdue && <span className="ml-1">(Overdue)</span>}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">No due date</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

