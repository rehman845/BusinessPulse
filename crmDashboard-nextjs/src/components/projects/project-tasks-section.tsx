"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Plus, RefreshCw, Loader2, Edit, Calendar, Trash } from "lucide-react";
import { tasksService } from "@/api";
import type { Task, TaskCreate, TaskUpdate } from "@/types";
import { toast } from "sonner";
import { format } from "date-fns";

interface ProjectTasksSectionProps {
  projectId: string;
}

const statusColors: Record<Task["status"], string> = {
  Todo: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  "In Progress": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  Done: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  Blocked: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export function ProjectTasksSection({ projectId }: ProjectTasksSectionProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [createForm, setCreateForm] = useState<TaskCreate>({
    title: "",
    description: "",
    status: "Todo",
  });
  const [editForm, setEditForm] = useState<TaskUpdate>({});

  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await tasksService.getProjectTasks(projectId);
      setTasks(data);
    } catch (error: any) {
      toast.error("Failed to load tasks", { description: error.message || "Please try again" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadTasks, 30000);
    return () => clearInterval(interval);
  }, [projectId]);

  const handleCreateTask = async () => {
    if (!createForm.title.trim()) {
      toast.error("Task title is required");
      return;
    }

    try {
      const newTask = await tasksService.createTask(projectId, createForm);
      setTasks([...tasks, newTask]);
      setCreateForm({ title: "", description: "", status: "Todo" });
      setCreateDialogOpen(false);
      toast.success("Task created successfully");
    } catch (error: any) {
      toast.error("Failed to create task", { description: error.message || "Please try again" });
    }
  };

  const handleUpdateTask = async () => {
    if (!editingTask) return;

    try {
      const updatedTask = await tasksService.updateTask(editingTask.id, editForm);
      setTasks(tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
      setEditForm({});
      setEditingTask(null);
      setEditDialogOpen(false);
      toast.success("Task updated successfully");
    } catch (error: any) {
      toast.error("Failed to update task", { description: error.message || "Please try again" });
    }
  };

  const handleStatusChange = async (task: Task, newStatus: Task["status"]) => {
    try {
      const updatedTask = await tasksService.updateTaskStatus(task.id, newStatus);
      setTasks(tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
      toast.success("Task status updated");
    } catch (error: any) {
      toast.error("Failed to update status", { description: error.message || "Please try again" });
    }
  };

  const handleDeleteTask = async (task: Task) => {
    if (!window.confirm(`Are you sure you want to delete task "${task.title}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await tasksService.deleteTask(task.id);
      setTasks(tasks.filter((t) => t.id !== task.id));
      toast.success("Task deleted successfully");
    } catch (error: any) {
      toast.error("Failed to delete task", { description: error.message || "Please try again" });
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const result = await tasksService.syncProjectTasks(projectId);
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

  const handleEditClick = (task: Task) => {
    setEditingTask(task);
    setEditForm({
      title: task.title,
      description: task.description || "",
      due_date: task.due_date,
    });
    setEditDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Notion Tasks</CardTitle>
            <CardDescription>
              Manage tasks for this project. Tasks are synced with Notion.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
            >
              {syncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync
                </>
              )}
            </Button>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  New Task
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Task</DialogTitle>
                  <DialogDescription>
                    Create a new task. It will be synced with Notion automatically.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={createForm.title}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, title: e.target.value })
                      }
                      placeholder="Task title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={createForm.description}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, description: e.target.value })
                      }
                      placeholder="Task description"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={createForm.status}
                      onValueChange={(value) =>
                        setCreateForm({ ...createForm, status: value as Task["status"] })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Todo">Todo</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Done">Done</SelectItem>
                        <SelectItem value="Blocked">Blocked</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="due_date">Due Date</Label>
                    <Input
                      id="due_date"
                      type="datetime-local"
                      value={
                        createForm.due_date
                          ? new Date(createForm.due_date).toISOString().slice(0, 16)
                          : ""
                      }
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          due_date: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                        })
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateTask}>Create Task</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-muted-foreground mb-4">No tasks yet.</p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create First Task
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
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
                    <Select
                      value={task.status}
                      onValueChange={(value) =>
                        handleStatusChange(task, value as Task["status"])
                      }
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Todo">Todo</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Done">Done</SelectItem>
                        <SelectItem value="Blocked">Blocked</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {task.due_date ? (
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(task.due_date), "MMM d, yyyy")}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">No due date</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditClick(task)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteTask(task)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Task</DialogTitle>
              <DialogDescription>
                Update task details. Changes will be synced with Notion.
              </DialogDescription>
            </DialogHeader>
            {editingTask && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-title">Title</Label>
                  <Input
                    id="edit-title"
                    value={editForm.title || editingTask.title}
                    onChange={(e) =>
                      setEditForm({ ...editForm, title: e.target.value })
                    }
                    placeholder="Task title"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={editForm.description ?? editingTask.description ?? ""}
                    onChange={(e) =>
                      setEditForm({ ...editForm, description: e.target.value })
                    }
                    placeholder="Task description"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-due_date">Due Date</Label>
                  <Input
                    id="edit-due_date"
                    type="datetime-local"
                    value={
                      editForm.due_date
                        ? new Date(editForm.due_date).toISOString().slice(0, 16)
                        : editingTask.due_date
                        ? new Date(editingTask.due_date).toISOString().slice(0, 16)
                        : ""
                    }
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        due_date: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                      })
                    }
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateTask}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

