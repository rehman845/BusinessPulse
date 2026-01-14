"use client";

import { useState, useEffect } from "react";
import { Invoice, InvoiceItem } from "@/types";
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
import { useProjects } from "@/hooks";
import { toast } from "sonner";
import { Plus, Trash } from "lucide-react";

interface NewInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvoiceCreated: (invoice: Invoice) => void | Promise<void>;
  invoice?: Invoice | null; // If provided, this is an edit dialog
}

export function NewInvoiceDialog({
  open,
  onOpenChange,
  onInvoiceCreated,
  invoice,
}: NewInvoiceDialogProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const { allProjectsList } = useProjects();
  const [loading, setLoading] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  const [formData, setFormData] = useState({
    customerId: "",
    customerName: "",
    customerEmail: "",
    projectId: "",
    projectName: "",
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    status: "draft" as Invoice["status"],
    description: "",
    notes: "",
  });

  const [items, setItems] = useState<InvoiceItem[]>([]);

  useEffect(() => {
    if (open) {
      loadCustomers();
      if (invoice) {
        // Populate form for editing - handle both camelCase and snake_case formats
        const issueDateStr = invoice.issueDate || invoice.issue_date || "";
        const dueDateStr = invoice.dueDate || invoice.due_date || "";
        setFormData({
          customerId: invoice.customerId || invoice.customer_id || "",
          customerName: invoice.customerName || invoice.customer_name || "",
          customerEmail: invoice.customerEmail || invoice.customer_email || "",
          projectId: invoice.projectId || invoice.project_id || "",
          projectName: invoice.projectName || invoice.project_name || "",
          issueDate: issueDateStr ? issueDateStr.split("T")[0] : new Date().toISOString().split("T")[0],
          dueDate: dueDateStr ? dueDateStr.split("T")[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          status: invoice.status,
          description: invoice.description || "",
          notes: invoice.notes || "",
        });
        setItems(invoice.items || invoice.line_items?.map(item => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: (item as any).unit_price || (item as any).unitPrice || 0,
          total: item.total,
        })) || []);
      } else {
        // Reset form for new invoice
        setFormData({
          customerId: "",
          customerName: "",
          customerEmail: "",
          projectId: "",
          projectName: "",
          issueDate: new Date().toISOString().split("T")[0],
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 30 days from now
          status: "draft",
          description: "",
          notes: "",
        });
        setItems([
          {
            id: `item-${Date.now()}`,
            description: "",
            quantity: 1,
            unitPrice: 0,
            total: 0,
          },
        ]);
      }
    }
  }, [open, invoice]);

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
        // Customer email is not stored in Customer model, user must enter manually
      });
    }
  };

  const handleProjectChange = (projectId: string) => {
    if (projectId === "none") {
      setFormData({ ...formData, projectId: "", projectName: "" });
      return;
    }
    const project = allProjectsList.find((p) => p.id === projectId);
    if (project) {
      setFormData({
        ...formData,
        projectId: project.id,
        projectName: project.projectName,
      });
    }
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        id: `item-${Date.now()}-${Math.random()}`,
        description: "",
        quantity: 1,
        unitPrice: 0,
        total: 0,
      },
    ]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, updates: Partial<InvoiceItem>) => {
    setItems(
      items.map((item) => {
        if (item.id === id) {
          const updated = { ...item, ...updates };
          updated.total = updated.quantity * updated.unitPrice;
          return updated;
        }
        return item;
      })
    );
  };

  const calculateTotals = () => {
    const amount = items.reduce((sum, item) => sum + item.total, 0);
    const tax = amount * 0.1; // 10% tax
    const totalAmount = amount + tax;
    return { amount, tax, totalAmount };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (items.length === 0 || items.some((item) => !item.description || item.unitPrice <= 0)) {
        toast.error("Please add at least one valid item to the invoice");
        setLoading(false);
        return;
      }

      // Generate invoice number
      const invoiceNumber = invoice
        ? (invoice.invoiceNumber || invoice.invoice_number)
        : `INV-${new Date().getFullYear()}-${String(
            Math.floor(Math.random() * 10000)
          ).padStart(4, "0")}`;

      const { amount, tax, totalAmount } = calculateTotals();
      const issueDateISO = new Date(formData.issueDate).toISOString();
      const dueDateISO = new Date(formData.dueDate).toISOString();

      const invoiceData: Invoice = {
        id: invoice?.id || `inv-${Date.now()}`,
        // Backend format (snake_case) - required
        invoice_number: invoiceNumber,
        customer_id: formData.customerId || undefined,
        customer_name: formData.customerName,
        customer_email: formData.customerEmail,
        project_id: formData.projectId || undefined,
        project_name: formData.projectName || undefined,
        subtotal: amount,
        tax,
        total: totalAmount,
        status: formData.status,
        issue_date: issueDateISO,
        due_date: dueDateISO,
        paid_date: invoice?.paidDate || invoice?.paid_date,
        notes: formData.notes || undefined,
        line_items: items.map((item) => ({
          id: item.id,
          category: (item as any).category || "other",
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total: item.quantity * item.unitPrice,
        })),
        // Legacy frontend format (camelCase) - optional but included for compatibility
        invoiceNumber,
        customerId: formData.customerId || undefined,
        customerName: formData.customerName,
        customerEmail: formData.customerEmail,
        projectId: formData.projectId || undefined,
        projectName: formData.projectName || undefined,
        amount,
        totalAmount,
        issueDate: issueDateISO,
        dueDate: dueDateISO,
        paidDate: invoice?.paidDate || invoice?.paid_date,
        description: formData.description || undefined,
        items: items.map((item) => ({
          ...item,
          total: item.quantity * item.unitPrice,
        })),
      };

      await onInvoiceCreated(invoiceData);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(
        error?.message || `Failed to ${invoice ? "update" : "create"} invoice`
      );
    } finally {
      setLoading(false);
    }
  };

  const { tax, totalAmount } = calculateTotals();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {invoice ? "Edit Invoice" : "Create New Invoice"}
          </DialogTitle>
          <DialogDescription>
            {invoice
              ? "Update invoice details below"
              : "Fill in the details to create a new invoice"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
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
                <Label htmlFor="project">Project (Optional)</Label>
                <Select
                  value={formData.projectId || "none"}
                  onValueChange={handleProjectChange}
                >
                  <SelectTrigger id="project">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Project</SelectItem>
                    {allProjectsList
                      .filter((p) => p.customerId === formData.customerId)
                      .map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.projectName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="customerEmail">
                Customer Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="customerEmail"
                type="email"
                value={formData.customerEmail}
                onChange={(e) =>
                  setFormData({ ...formData, customerEmail: e.target.value })
                }
                placeholder="customer@example.com"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="invoiceNumber">Invoice Number</Label>
                <Input
                  id="invoiceNumber"
                  value={invoice?.invoiceNumber || `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="issueDate">
                  Issue Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={formData.issueDate}
                  onChange={(e) =>
                    setFormData({ ...formData, issueDate: e.target.value })
                  }
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="dueDate">
                  Due Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) =>
                    setFormData({ ...formData, dueDate: e.target.value })
                  }
                  min={formData.issueDate}
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    status: value as Invoice["status"],
                  })
                }
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Invoice Items */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Invoice Items</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addItem}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>
              <div className="border rounded-lg p-4 space-y-4">
                {items.map((item, index) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      <Label className="text-xs">Description</Label>
                      <Input
                        value={item.description}
                        onChange={(e) =>
                          updateItem(item.id, { description: e.target.value })
                        }
                        placeholder="Item description"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Quantity</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(item.id, {
                            quantity: parseInt(e.target.value) || 1,
                          })
                        }
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Unit Price</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) =>
                          updateItem(item.id, {
                            unitPrice: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Total</Label>
                      <Input
                        value={`$${item.total.toFixed(2)}`}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                    <div className="col-span-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(item.id)}
                        disabled={items.length === 1}
                      >
                        <Trash className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>${(totalAmount - tax).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tax (10%):</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total:</span>
                <span>${totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Invoice description or notes..."
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Payment terms, additional information..."
                rows={2}
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
                ? invoice
                  ? "Updating..."
                  : "Creating..."
                : invoice
                ? "Update Invoice"
                : "Create Invoice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
