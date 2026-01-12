"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { customersService, type Customer } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2, Users, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newCustomerName, setNewCustomerName] = useState("");

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const data = await customersService.getCustomers();
      setCustomers(data);
    } catch (error: any) {
      toast.error("Failed to load customers", {
        description: error.message || "Please try again",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) {
      toast.error("Customer name is required");
      return;
    }

    try {
      setCreating(true);
      const newCustomer = await customersService.createCustomer({ name: newCustomerName.trim() });
      toast.success("Customer created successfully");
      setNewCustomerName("");
      await fetchCustomers(); // Refresh list
    } catch (error: any) {
      toast.error("Failed to create customer", {
        description: error.message || "Please try again",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm("Are you sure you want to delete this customer? This is only allowed if they have no related data.")) {
      return;
    }
    try {
      setDeletingId(id);
      await customersService.deleteCustomer(id);
      toast.success("Customer deleted");
      await fetchCustomers();
    } catch (error: any) {
      toast.error("Failed to delete customer", {
        description: error.message || "Customer may still have documents or proposals attached.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">
            Manage your customers and their information
          </p>
        </div>
      </div>

      {/* Create Customer Form */}
      <Card>
        <CardHeader>
          <CardTitle>Create New Customer</CardTitle>
          <CardDescription>Add a new customer to the system</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateCustomer} className="flex gap-2">
            <Input
              placeholder="Customer name"
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              disabled={creating}
              className="max-w-sm"
            />
            <Button type="submit" disabled={creating || !newCustomerName.trim()}>
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Customers List */}
      <Card>
        <CardHeader>
          <CardTitle>All Customers</CardTitle>
          <CardDescription>
            {customers.length} {customers.length === 1 ? "customer" : "customers"} in total. Click a row to open the customer workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No customers yet. Create your first customer above!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow
                    key={customer.id}
                    className="cursor-pointer hover:bg-muted/60"
                    onClick={() => router.push(`/dashboard/customers/${customer.id}`)}
                  >
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>
                      {customer.created_at
                        ? new Date(customer.created_at).toLocaleDateString()
                        : "N/A"}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {customer.id}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteCustomer(customer.id)}
                        disabled={deletingId === customer.id}
                      >
                        {deletingId === customer.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-destructive" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


