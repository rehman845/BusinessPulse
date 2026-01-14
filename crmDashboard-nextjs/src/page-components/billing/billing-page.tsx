"use client";

import { useEffect, useState, useMemo } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, RefreshCcw, Edit, Trash, Check } from "lucide-react";
import { billingService } from "@/api/services/billing.service";
import type { BillingExpense, BillingExpenseCreate, BillingExpenseUpdate } from "@/types";
import { format } from "date-fns";

const defaultForm: BillingExpenseCreate = {
  expense_type: "subscription",
  vendor_name: "",
  description: "",
  amount: 0,
  currency: "USD",
  frequency: "monthly",
};

export function BillingPage() {
  const [expenses, setExpenses] = useState<BillingExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState<BillingExpenseCreate>(defaultForm);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<BillingExpense | null>(null);
  const [editForm, setEditForm] = useState<BillingExpenseUpdate>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "overdue">("all");

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const data = await billingService.getExpenses();
      setExpenses(data);
    } catch (error: any) {
      toast.error("Failed to load expenses", { description: error.message || "Please try again" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vendor_name.trim() || formData.amount <= 0) {
      toast.error("Please provide valid expense details");
      return;
    }

    try {
      setCreating(true);
      await billingService.createExpense(formData);
      toast.success("Expense added");
      setFormData(defaultForm);
      await loadExpenses();
    } catch (error: any) {
      toast.error("Failed to add expense", { description: error.message || "Please try again" });
    } finally {
      setCreating(false);
    }
  };

  const handleMarkAsPaid = async (expense: BillingExpense) => {
    try {
      await billingService.updateExpense(expense.id, {
        paid_date: new Date().toISOString(),
      });
      toast.success("Marked expense as paid");
      await loadExpenses();
    } catch (error: any) {
      toast.error("Failed to mark expense as paid", {
        description: error.message || "Please try again",
      });
    }
  };

  const openEditDialog = (expense: BillingExpense) => {
    setEditExpense(expense);
    setEditForm({
      expense_type: expense.expense_type,
      vendor_name: expense.vendor_name,
      description: expense.description,
      amount: expense.amount,
      currency: expense.currency,
      frequency: expense.frequency,
      due_date: expense.due_date || undefined,
      paid_date: expense.paid_date || undefined,
    });
    setEditDialogOpen(true);
  };

  const handleUpdateExpense = async () => {
    if (!editExpense) return;
    if (editForm.amount !== undefined && editForm.amount < 0) {
      toast.error("Amount must be greater than or equal to zero");
      return;
    }

    try {
      setSavingEdit(true);
      await billingService.updateExpense(editExpense.id, editForm);
      toast.success("Expense updated");
      setEditDialogOpen(false);
      setEditExpense(null);
      setEditForm({});
      await loadExpenses();
    } catch (error: any) {
      toast.error("Failed to update expense", { description: error.message || "Please try again" });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteExpense = async (expense: BillingExpense) => {
    if (!window.confirm(`Delete expense: ${expense.vendor_name}?`)) {
      return;
    }

    try {
      await billingService.deleteExpense(expense.id);
      toast.success("Expense deleted");
      await loadExpenses();
    } catch (error: any) {
      toast.error("Failed to delete expense", { description: error.message || "Please try again" });
    }
  };

  const totalAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const unpaidAmount = expenses
    .filter((e) => !e.paid_date)
    .reduce((sum, exp) => sum + exp.amount, 0);

  const filteredExpenses = useMemo(() => {
    if (statusFilter === "all") return expenses;

    const now = new Date();
    return expenses.filter((e) => {
      if (statusFilter === "paid") {
        return !!e.paid_date;
      }
      // overdue = unpaid and due_date in the past
      if (statusFilter === "overdue") {
        if (e.paid_date) return false;
        if (!e.due_date) return false;
        return new Date(e.due_date) < now;
      }
      return true;
    });
  }, [expenses, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Manage subscriptions, vendor payments, and other business expenses.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Expenses</CardDescription>
            <CardTitle className="text-2xl">${totalAmount.toFixed(2)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unpaid</CardDescription>
            <CardTitle className="text-2xl">${unpaidAmount.toFixed(2)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Items</CardDescription>
            <CardTitle className="text-2xl">{expenses.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Expense</CardTitle>
          <CardDescription>
            Add a new subscription, vendor payment, or other expense.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateExpense} className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Expense Type</label>
              <Select
                value={formData.expense_type}
                onValueChange={(value) =>
                  setFormData({ ...formData, expense_type: value as any })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="subscription">Subscription</SelectItem>
                  <SelectItem value="vendor">Vendor</SelectItem>
                  <SelectItem value="consultant">Consultant</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Vendor Name</label>
              <Input
                placeholder="Cursor Pro, AWS, etc."
                value={formData.vendor_name}
                onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Amount ($)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
                }
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Frequency</label>
              <Select
                value={formData.frequency}
                onValueChange={(value) =>
                  setFormData({ ...formData, frequency: value as any })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_time">One Time</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Input
                placeholder="Optional description"
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="md:col-span-3 flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => loadExpenses()}>
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
                    Add Expense
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Expenses</CardTitle>
          <CardDescription>All business expenses and payments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={statusFilter === "all" ? "default" : "outline"}
                onClick={() => setStatusFilter("all")}
              >
                All
              </Button>
              <Button
                size="sm"
                variant={statusFilter === "paid" ? "default" : "outline"}
                onClick={() => setStatusFilter("paid")}
              >
                Paid
              </Button>
              <Button
                size="sm"
                variant={statusFilter === "overdue" ? "default" : "outline"}
                onClick={() => setStatusFilter("overdue")}
              >
                Overdue
              </Button>
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No expenses yet. Use the form above to add your first expense.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">{expense.vendor_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{expense.expense_type}</Badge>
                      </TableCell>
                      <TableCell>{expense.frequency}</TableCell>
                      <TableCell className="text-right font-mono">
                        ${expense.amount.toFixed(2)} {expense.currency}
                      </TableCell>
                      <TableCell>
                        {expense.due_date
                          ? format(new Date(expense.due_date), "MMM d, yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={expense.paid_date ? "default" : "secondary"}>
                          {expense.paid_date ? "Paid" : "Unpaid"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {!expense.paid_date && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleMarkAsPaid(expense)}
                              title="Mark as paid"
                            >
                              <Check className="h-4 w-4 text-green-500" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(expense)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteExpense(expense)}
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
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>Update the expense details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium mb-1 block">Expense Type</label>
                <Select
                  value={editForm.expense_type || ""}
                  onValueChange={(value) =>
                    setEditForm((prev) => ({ ...prev, expense_type: value as any }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subscription">Subscription</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="consultant">Consultant</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Vendor Name</label>
                <Input
                  value={editForm.vendor_name ?? ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, vendor_name: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium mb-1 block">Amount</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.amount ?? ""}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      amount: parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Frequency</label>
                <Select
                  value={editForm.frequency || ""}
                  onValueChange={(value) =>
                    setEditForm((prev) => ({ ...prev, frequency: value as any }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">One Time</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Input
                value={editForm.description ?? ""}
                onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateExpense} disabled={savingEdit}>
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
