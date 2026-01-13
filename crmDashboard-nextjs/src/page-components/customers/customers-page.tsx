"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { customersService, type Customer } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2, Users, Trash2, UserPlus, Calendar, Hash, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            Customers
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your customers and their information
          </p>
        </div>
      </div>

      {/* Create Customer Form */}
      <Card className="border-2 border-dashed">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Create New Customer
          </CardTitle>
          <CardDescription>Add a new customer to the system</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateCustomer} className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Enter customer name..."
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              disabled={creating}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !creating && newCustomerName.trim()) {
                  handleCreateCustomer(e as any);
                }
              }}
            />
            <Button type="submit" disabled={creating || !newCustomerName.trim()} className="sm:w-auto w-full">
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Customer
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Customers List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                All Customers
              </CardTitle>
              <CardDescription className="mt-1">
                {loading ? (
                  "Loading customers..."
                ) : (
                  <>
                    {customers.length} {customers.length === 1 ? "customer" : "customers"} in total
                    {customers.length > 0 && ". Click a row to open the customer workspace."}
                  </>
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading customers...</p>
              </div>
            </div>
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-6 mb-4">
                <Users className="h-12 w-12 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No customers yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mb-4">
                Get started by creating your first customer. You can then upload documents, manage projects, and track interactions.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Customer Name</TableHead>
                    <TableHead className="w-[150px]">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Created At
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4" />
                        Customer ID
                      </div>
                    </TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer, index) => (
                    <TableRow
                      key={customer.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors group"
                      onClick={() => router.push(`/dashboard/customers/${customer.id}`)}
                    >
                      <TableCell className="font-semibold">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                            {customer.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="group-hover:text-primary transition-colors">{customer.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {customer.created_at
                          ? format(new Date(customer.created_at), "MMM dd, yyyy")
                          : "N/A"}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground font-mono">
                          {customer.id.slice(0, 8)}...
                        </code>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/dashboard/customers/${customer.id}`)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteCustomer(customer.id)}
                            disabled={deletingId === customer.id}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            {deletingId === customer.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
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
    </div>
  );
}


