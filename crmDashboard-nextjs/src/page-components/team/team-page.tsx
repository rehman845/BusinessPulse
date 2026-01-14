"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, RefreshCcw, Edit, Trash, Eye } from "lucide-react";
import { teamService } from "@/api/services/team.service";
import type { Employee, EmployeeCreate, EmployeeUpdate } from "@/types";

const defaultForm: EmployeeCreate = {
  full_name: "",
  role: "Employee",
  hourly_rate: 0,
  hours_per_day: 8,
  days_per_week: 5,
  is_active: true,
};

export function TeamPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState<EmployeeCreate>(defaultForm);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState<EmployeeUpdate>({});
  const [savingEdit, setSavingEdit] = useState(false);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const data = await teamService.getEmployees();
      setEmployees(data);
    } catch (error: any) {
      toast.error("Failed to load employees", { description: error.message || "Please try again" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name.trim() || formData.hourly_rate <= 0) {
      toast.error("Please provide valid employee details");
      return;
    }

    try {
      setCreating(true);
      // Ensure role is always "Employee"
      const employeeData = { ...formData, role: "Employee" };
      await teamService.createEmployee(employeeData);
      toast.success("Employee added");
      setFormData(defaultForm);
      await loadEmployees();
    } catch (error: any) {
      toast.error("Failed to add employee", { description: error.message || "Please try again" });
    } finally {
      setCreating(false);
    }
  };

  const openEditDialog = (employee: Employee) => {
    setEditEmployee(employee);
    setEditForm({
      full_name: employee.full_name,
      role: employee.role,
      hourly_rate: employee.hourly_rate,
      is_active: employee.is_active,
    });
    setEditDialogOpen(true);
  };

  const handleUpdateEmployee = async () => {
    if (!editEmployee) return;
    if (editForm.hourly_rate !== undefined && (editForm.hourly_rate < 0 || Number.isNaN(editForm.hourly_rate))) {
      toast.error("Hourly rate must be greater than or equal to zero");
      return;
    }

    try {
      setSavingEdit(true);
      await teamService.updateEmployee(editEmployee.id, editForm);
      toast.success("Employee updated");
      setEditDialogOpen(false);
      setEditEmployee(null);
      setEditForm({});
      await loadEmployees();
    } catch (error: any) {
      toast.error("Failed to update employee", { description: error.message || "Please try again" });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteEmployee = async (employee: Employee) => {
    if (!window.confirm(`Delete ${employee.full_name}? This action cannot be undone.`)) {
      return;
    }

    try {
      await teamService.deleteEmployee(employee.id);
      toast.success("Employee deleted");
      await loadEmployees();
    } catch (error: any) {
      toast.error("Failed to delete employee", { description: error.message || "Please try again" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">
          Manage your team members and their hourly rates.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Employee</CardTitle>
          <CardDescription>
            Add a new team member with their hourly salary rate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateEmployee} className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Full Name</label>
              <Input
                placeholder="John Doe"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Hourly Rate ($)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.hourly_rate}
                onChange={(e) =>
                  setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })
                }
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Hours per Day</label>
              <Input
                type="number"
                min="0"
                max="24"
                step="0.5"
                value={formData.hours_per_day || 8}
                onChange={(e) =>
                  setFormData({ ...formData, hours_per_day: parseFloat(e.target.value) || 8 })
                }
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Days per Week</label>
              <Input
                type="number"
                min="0"
                max="7"
                step="0.5"
                value={formData.days_per_week || 5}
                onChange={(e) =>
                  setFormData({ ...formData, days_per_week: parseFloat(e.target.value) || 5 })
                }
                required
              />
            </div>
            <div className="md:col-span-2 flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => loadEmployees()}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Employee
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>Overview of all team members and their details</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : employees.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No employees yet. Use the form above to add your first team member.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Hourly Rate</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">{employee.full_name}</TableCell>
                      <TableCell>{employee.role}</TableCell>
                      <TableCell className="text-right font-mono">
                        ${employee.hourly_rate.toFixed(2)}/hr
                      </TableCell>
                      <TableCell>
                        <Badge variant={employee.is_active ? "default" : "secondary"}>
                          {employee.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push(`/dashboard/team/${employee.id}`)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(employee)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteEmployee(employee)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>Update the employee details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium mb-1 block">Full Name</label>
                <Input
                  value={editForm.full_name ?? ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, full_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Role</label>
                <Input
                  value={editForm.role ?? ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium mb-1 block">Hourly Rate ($)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.hourly_rate ?? ""}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      hourly_rate: parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Status</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={editForm.is_active === undefined ? "" : editForm.is_active ? "true" : "false"}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      is_active: e.target.value === "true",
                    }))
                  }
                >
                  <option value="">Keep current</option>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateEmployee} disabled={savingEdit}>
              {savingEdit ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
