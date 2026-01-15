"use client";

import { useEffect, useState } from "react";
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
import { Loader2, Plus, RefreshCcw, Edit, Trash } from "lucide-react";
import {
  resourcesService,
  type Resource,
  type ResourceCreate,
  type ResourceUpdate,
} from "@/api/services/resources.service";

const defaultForm: ResourceCreate = {
  resource_name: "",
  company_name: "",
  total_hours: 40,
};

export function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState<ResourceCreate>(defaultForm);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editResource, setEditResource] = useState<Resource | null>(null);
  const [editForm, setEditForm] = useState<ResourceUpdate>({});
  const [savingEdit, setSavingEdit] = useState(false);

  const loadResources = async () => {
    try {
      setLoading(true);
      const data = await resourcesService.getResources();
      setResources(data);
    } catch (error: any) {
      toast.error("Failed to load partner companies", { description: error.message || "Please try again" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResources();
  }, []);

  const handleCreateResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.resource_name.trim() || !formData.company_name.trim() || formData.total_hours <= 0) {
      toast.error("Please provide valid partner company details");
      return;
    }

    try {
      setCreating(true);
      await resourcesService.createResource(formData);
      toast.success("Partner company added");
      setFormData(defaultForm);
      await loadResources();
    } catch (error: any) {
      toast.error("Failed to add partner company", { description: error.message || "Please try again" });
    } finally {
      setCreating(false);
    }
  };

  const openEditDialog = (resource: Resource) => {
    setEditResource(resource);
    setEditForm({
      resource_name: resource.resource_name,
      company_name: resource.company_name,
      total_hours: resource.total_hours,
    });
    setEditDialogOpen(true);
  };

  const handleUpdateResource = async () => {
    if (!editResource) return;
    if (
      editForm.total_hours !== undefined &&
      (editForm.total_hours <= 0 || Number.isNaN(editForm.total_hours))
    ) {
      toast.error("Total hours must be greater than zero");
      return;
    }

    try {
      setSavingEdit(true);
      await resourcesService.updateResource(editResource.id, editForm);
      toast.success("Partner company updated");
      setEditDialogOpen(false);
      setEditResource(null);
      setEditForm({});
      await loadResources();
    } catch (error: any) {
      toast.error("Failed to update partner company", { description: error.message || "Please try again" });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteResource = async (resource: Resource) => {
    if (
      !window.confirm(
        `Delete ${resource.resource_name}? This will fail if the partner company is assigned to any project.`
      )
    ) {
      return;
    }

    try {
      await resourcesService.deleteResource(resource.id);
      toast.success("Partner company deleted");
      await loadResources();
    } catch (error: any) {
      toast.error("Failed to delete partner company", { description: error.message || "Please remove project assignments first" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Partner Companies</h1>
        <p className="text-sm text-muted-foreground">
          Manage your outsourcing partners, their availability, and keep track of global capacity.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Partner Company</CardTitle>
          <CardDescription>
            Capture contact name, company name, and the total number of hours they can contribute.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateResource} className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Contact Name</label>
              <Input
                placeholder="Jane Smith"
                value={formData.resource_name}
                onChange={(e) => setFormData({ ...formData, resource_name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Company Name</label>
              <Input
                placeholder="Acme Consulting"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Total Available Hours</label>
              <Input
                type="number"
                min="1"
                value={formData.total_hours}
                onChange={(e) =>
                  setFormData({ ...formData, total_hours: parseInt(e.target.value, 10) || 0 })
                }
                required
              />
            </div>
            <div className="md:col-span-3 flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => loadResources()}>
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
                    Add Partner Company
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Partner Companies</CardTitle>
          <CardDescription>Overview of all partner companies and their remaining availability</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : resources.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No partner companies yet. Use the form above to add your first partner company.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead className="text-right">Total Hours</TableHead>
                    <TableHead className="text-right">Available Hours</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resources.map((resource) => (
                    <TableRow key={resource.id}>
                      <TableCell className="font-medium">{resource.resource_name}</TableCell>
                      <TableCell>{resource.company_name}</TableCell>
                      <TableCell className="text-right">{resource.total_hours}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={resource.available_hours > 0 ? "secondary" : "outline"}
                          className="font-mono"
                        >
                          {resource.available_hours} hrs
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(resource)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteResource(resource)}
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
            <DialogTitle>Edit Partner Company</DialogTitle>
            <DialogDescription>Update the partner company details and capacity.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium mb-1 block">Contact Name</label>
                <Input
                  value={editForm.resource_name ?? ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, resource_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Company Name</label>
                <Input
                  value={editForm.company_name ?? ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, company_name: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Total Hours</label>
              <Input
                type="number"
                min="1"
                value={editForm.total_hours ?? ""}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    total_hours: parseInt(e.target.value, 10) || 0,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Available hours will adjust automatically based on current project allocations.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateResource} disabled={savingEdit}>
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
