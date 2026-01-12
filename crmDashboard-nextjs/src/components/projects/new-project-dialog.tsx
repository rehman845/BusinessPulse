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
import { customersService, type Customer } from "@/api";
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

      const projectData: Project = {
        id: project?.id || `proj-${Date.now()}`,
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
        assignedTo: formData.assignedTo || undefined,
      };

      onProjectCreated(projectData);
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
              <Label htmlFor="assignedTo">Assigned To</Label>
              <Input
                id="assignedTo"
                value={formData.assignedTo}
                onChange={(e) =>
                  setFormData({ ...formData, assignedTo: e.target.value })
                }
                placeholder="Team member name"
              />
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
