"use client";

import { useState, useEffect } from "react";
import { Project } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { customersService, teamService, projectsService, type Customer } from "@/api";
import type { Employee } from "@/types";
import { toast } from "sonner";

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated: (project: Project) => void;
  project?: Project | null; // If provided, this is an edit dialog
}

export function NewProjectDialog({
  open,
  onOpenChange,
  onProjectCreated,
  project,
}: NewProjectDialogProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    projectName: "",
    customerId: "",
    customerName: "",
    email: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    budget: "",
    description: "",
    assignedTo: "",
    status: "planning" as Project["status"],
  });

  useEffect(() => {
    if (open) {
      loadCustomers();
      loadEmployees();
      if (project) {
        // Populate form for editing
        setFormData({
          projectName: project.projectName,
          customerId: project.customerId || "",
          customerName: project.customerName,
          email: project.email,
          startDate: project.startDate.split("T")[0],
          endDate: project.endDate ? project.endDate.split("T")[0] : "",
          budget: project.budget?.toString() || "",
          description: project.description || "",
          assignedTo: project.assignedTo || "",
          status: project.status,
        });

        // Load existing employee assignments for this project so they appear selected
        if (project.id) {
          loadProjectEmployees(project.id);
        }
      } else {
        // Reset form for new project
        setFormData({
          projectName: "",
          customerId: "",
          customerName: "",
          email: "",
          startDate: new Date().toISOString().split("T")[0],
          endDate: "",
          budget: "",
          description: "",
          assignedTo: "",
          status: "planning",
        });
        setSelectedEmployeeIds([]);
      }
    }
  }, [open, project]);

  const loadCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const data = await customersService.getCustomers();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error("Failed to load customers");
    } finally {
      setLoadingCustomers(false);
    }
  };

  const loadEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const data = await teamService.getEmployees(true); // only active employees
      setEmployees(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load employees", error);
      toast.error("Failed to load employees");
    } finally {
      setLoadingEmployees(false);
    }
  };

  const loadProjectEmployees = async (projectId: string) => {
    try {
      const assignments = await teamService.getProjectEmployees(projectId);
      const ids = assignments.map((a) => a.employee_id);
      setSelectedEmployeeIds(ids);
    } catch (error) {
      console.error("Failed to load project employees", error);
      // Don't block dialog on this
    }
  };

  const handleCustomerChange = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    if (customer) {
      setFormData({
        ...formData,
        customerId: customer.id,
        customerName: customer.name,
        email: "", // Email would need to come from customer data or be separate
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Generate project number
      const projectNumber = project
        ? project.projectNumber
        : `PRJ-${new Date().getFullYear()}-${String(
            Math.floor(Math.random() * 10000)
          ).padStart(3, "0")}`;

      // Derive a friendly "Assigned To" string from selected employees
      const assignedNames =
        employees
          .filter((emp) => selectedEmployeeIds.includes(emp.id))
          .map((emp) => emp.full_name)
          .join(", ") || formData.assignedTo || undefined;

      let projectData: Project;

      if (project) {
        // Update existing project
        projectData = await projectsService.updateProject(project.id, {
          projectNumber,
          projectName: formData.projectName,
          customerId: formData.customerId,
          customerName: formData.customerName,
          email: formData.email || `${formData.customerName.toLowerCase().replace(/\s+/g, ".")}@example.com`,
          status: formData.status,
          startDate: new Date(formData.startDate).toISOString(),
          endDate: formData.endDate
            ? new Date(formData.endDate).toISOString()
            : undefined,
          budget: formData.budget ? parseFloat(formData.budget) : undefined,
          description: formData.description || undefined,
          assignedTo: assignedNames,
        });
      } else {
        // Create new project
        projectData = await projectsService.createProject({
          projectNumber,
          projectName: formData.projectName,
          customerId: formData.customerId,
          customerName: formData.customerName,
          email: formData.email || `${formData.customerName.toLowerCase().replace(/\s+/g, ".")}@example.com`,
          status: formData.status,
          startDate: new Date(formData.startDate).toISOString(),
          endDate: formData.endDate
            ? new Date(formData.endDate).toISOString()
            : undefined,
          budget: formData.budget ? parseFloat(formData.budget) : undefined,
          description: formData.description || undefined,
          assignedTo: assignedNames,
        });
      }

      onProjectCreated(projectData);

      // Sync employee assignments for both new and existing projects
      try {
        if (project) {
          // Editing: Sync assignments (add new, remove unselected)
          const currentAssignments = await teamService.getProjectEmployees(project.id);
          const currentEmployeeIds = new Set(currentAssignments.map((a) => a.employee_id));
          const selectedIds = new Set(selectedEmployeeIds);

          // Remove employees that are no longer selected
          const toRemove = currentAssignments.filter((a) => !selectedIds.has(a.employee_id));
          await Promise.all(
            toRemove.map((assignment) =>
              teamService.removeEmployeeFromProject(project.id, assignment.id).catch(() => null)
            )
          );

          // Add newly selected employees
          const toAdd = selectedEmployeeIds.filter((id) => !currentEmployeeIds.has(id));
          await Promise.all(
            toAdd.map((employeeId) =>
              teamService.assignEmployeeToProject(project.id, employeeId).catch(() => {
                // Backend prevents duplicates; ignore conflicts
                return null;
              })
            )
          );
        } else {
          // New project: Create assignments for all selected employees
          if (selectedEmployeeIds.length > 0) {
            await Promise.all(
              selectedEmployeeIds.map((employeeId) =>
                teamService.assignEmployeeToProject(projectData.id, employeeId).catch(() => {
                  // Backend prevents duplicates; ignore per-employee errors
                  return null;
                })
              )
            );
          }
        }
      } catch (error) {
        console.error("Failed to sync employee assignments", error);
        // Surface a soft warning but don't block project creation/update
        toast.warning("Employee assignments could not be fully synced. You can adjust them from the project details page.");
      }

      // Toast will be shown by the parent component
      onOpenChange(false);
    } catch (error: any) {
      toast.error(
        error?.message || `Failed to ${project ? "update" : "create"} project`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {project ? "Edit Project" : "Create New Project"}
          </DialogTitle>
          <DialogDescription>
            {project
              ? "Update project details below"
              : "Fill in the details to create a new project"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="projectName">
                Project Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="projectName"
                value={formData.projectName}
                onChange={(e) =>
                  setFormData({ ...formData, projectName: e.target.value })
                }
                placeholder="Enter project name"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="customer">
                Customer <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.customerId}
                onValueChange={handleCustomerChange}
                disabled={loadingCustomers}
                required
              >
                <SelectTrigger id="customer">
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="customer@example.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startDate">
                  Start Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData({ ...formData, startDate: e.target.value })
                  }
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData({ ...formData, endDate: e.target.value })
                  }
                  min={formData.startDate}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="budget">Budget ($)</Label>
                <Input
                  id="budget"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.budget}
                  onChange={(e) =>
                    setFormData({ ...formData, budget: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      status: value as Project["status"],
                    })
                  }
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="execution">In Execution</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Assigned Employees</Label>
              <p className="text-xs text-muted-foreground">
                Select one or more employees from your Team to associate with this project.
                You can always adjust assignments later from the project details page.
              </p>
              <div className="rounded-md border max-h-40 overflow-y-auto p-3 space-y-2">
                {loadingEmployees ? (
                  <p className="text-xs text-muted-foreground">Loading employees...</p>
                ) : employees.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No employees found. Add employees from the Team section first.
                  </p>
                ) : (
                  employees.map((employee) => {
                    const checked = selectedEmployeeIds.includes(employee.id);
                    return (
                      <label
                        key={employee.id}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => {
                            const isChecked = value === true;
                            setSelectedEmployeeIds((prev) =>
                              isChecked
                                ? [...prev, employee.id]
                                : prev.filter((id) => id !== employee.id)
                            );
                          }}
                        />
                        <span className="flex-1">
                          <span className="font-medium">{employee.full_name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {employee.role}
                          </span>
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">
                          ${employee.hourly_rate.toFixed(2)}/hr
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
              {selectedEmployeeIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Selected: {selectedEmployeeIds.length}{" "}
                  {selectedEmployeeIds.length === 1 ? "employee" : "employees"}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Project description and objectives..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? project
                  ? "Updating..."
                  : "Creating..."
                : project
                ? "Update Project"
                : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
