"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/utils/format";
import { invoicesService, billingService, teamService } from "@/api/services";
import type { Invoice, BillingExpense, Employee } from "@/types";
import { Loader2, TrendingUp, TrendingDown, DollarSign } from "lucide-react";

interface MonthlyData {
  month: string;
  profits: number;
  expenditures: {
    billing: number;
    salaries: number;
    subscriptions: number;
    outsourcing: number;
  };
  net: number;
}

interface RevenueBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RevenueBreakdownDialog({ open, onOpenChange }: RevenueBreakdownDialogProps) {
  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [totalProfits, setTotalProfits] = useState(0);
  const [totalExpenditures, setTotalExpenditures] = useState(0);

  useEffect(() => {
    if (open) {
      loadRevenueData();
    }
  }, [open]);

  const loadRevenueData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [invoices, expenses, employees] = await Promise.all([
        invoicesService.getInvoices({ status: "paid" }),
        billingService.getExpenses(),
        teamService.getEmployees(true), // Only active employees
      ]);

      // Group data by month
      const monthlyMap = new Map<string, MonthlyData>();

      // Process paid invoices (profits)
      invoices.forEach((invoice: Invoice) => {
        const paidDate = invoice.paid_date || invoice.paidDate;
        if (!paidDate) return;

        const date = new Date(paidDate);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const monthLabel = date.toLocaleDateString("en-US", { year: "numeric", month: "long" });

        if (!monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, {
            month: monthLabel,
            profits: 0,
            expenditures: {
              billing: 0,
              salaries: 0,
              subscriptions: 0,
              outsourcing: 0,
            },
            net: 0,
          });
        }

        const data = monthlyMap.get(monthKey)!;
        const amount = invoice.total || invoice.totalAmount || 0;
        data.profits += amount;
      });

      // Process billing expenses (expenditures)
      expenses.forEach((expense: BillingExpense) => {
        const expenseDate = expense.paid_date || expense.due_date;
        if (!expenseDate) return;

        const date = new Date(expenseDate);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const monthLabel = date.toLocaleDateString("en-US", { year: "numeric", month: "long" });

        if (!monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, {
            month: monthLabel,
            profits: 0,
            expenditures: {
              billing: 0,
              salaries: 0,
              subscriptions: 0,
              outsourcing: 0,
            },
            net: 0,
          });
        }

        const data = monthlyMap.get(monthKey)!;
        const amount = expense.amount || 0;

        if (expense.expense_type === "subscription") {
          data.expenditures.subscriptions += amount;
        } else if (expense.expense_type === "vendor" || expense.expense_type === "consultant") {
          data.expenditures.outsourcing += amount;
        }
        data.expenditures.billing += amount;
      });

      // Process employee monthly salaries based on schedule (hours_per_day * days_per_week * 4 weeks * hourly_rate)
      // Add monthly salary to all months that have any activity (to show consistent monthly costs)
      const monthlySalaryPerEmployee = employees.reduce((total, emp) => {
        const hoursPerWeek = (emp.hours_per_day || 8) * (emp.days_per_week || 5);
        const hoursPerMonth = hoursPerWeek * 4; // Approximate 4 weeks per month
        const monthlySalary = (emp.hourly_rate || 0) * hoursPerMonth;
        return total + monthlySalary;
      }, 0);

      // Add monthly salaries to all months in the map
      monthlyMap.forEach((data) => {
        data.expenditures.salaries += monthlySalaryPerEmployee;
      });

      // Calculate net and totals - sort by month key instead
      const sortedMonths = Array.from(monthlyMap.entries())
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([, data]) => data);

      sortedMonths.forEach((data) => {
        const totalExp = 
          data.expenditures.billing + 
          data.expenditures.salaries + 
          data.expenditures.subscriptions + 
          data.expenditures.outsourcing;
        data.net = data.profits - totalExp;
      });

      setMonthlyData(sortedMonths);

      // Calculate totals
      const totalP = sortedMonths.reduce((sum, m) => sum + m.profits, 0);
      const totalE = sortedMonths.reduce((sum, m) => {
        return sum + m.expenditures.billing + m.expenditures.salaries + 
               m.expenditures.subscriptions + m.expenditures.outsourcing;
      }, 0);
      setTotalProfits(totalP);
      setTotalExpenditures(totalE);
    } catch (error) {
      console.error("Failed to load revenue data", error);
    } finally {
      setLoading(false);
    }
  };

  const grandTotal = totalProfits - totalExpenditures;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Monthly Revenue Breakdown</DialogTitle>
          <DialogDescription>
            Detailed breakdown of profits and expenditures by month
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 overflow-x-hidden">
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Profits</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-500 shrink-0" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600 break-words">
                    {formatCurrency(totalProfits)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Expenditures</CardTitle>
                  <TrendingDown className="h-4 w-4 text-red-500 shrink-0" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600 break-words">
                    {formatCurrency(totalExpenditures)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Net Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold break-words ${grandTotal >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(grandTotal)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Monthly Breakdown */}
            {monthlyData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No revenue data available
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Monthly Breakdown</h3>
                {monthlyData.map((month, index) => {
                  const totalExp = 
                    month.expenditures.billing + 
                    month.expenditures.salaries + 
                    month.expenditures.subscriptions + 
                    month.expenditures.outsourcing;
                  
                  return (
                    <Card key={index} className="overflow-hidden">
                      <CardHeader>
                        <CardTitle className="text-base break-words">{month.month}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Profits */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="min-w-0">
                            <p className="text-sm text-muted-foreground">Profits (Paid Invoices)</p>
                            <p className="text-lg font-semibold text-green-600 break-words">
                              {formatCurrency(month.profits)}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-muted-foreground">Net</p>
                            <p className={`text-lg font-semibold break-words ${month.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {formatCurrency(month.net)}
                            </p>
                          </div>
                        </div>

                        {/* Expenditures Breakdown */}
                        <div className="min-w-0">
                          <p className="text-sm text-muted-foreground mb-2">Expenditures:</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                            <div className="flex justify-between gap-2 min-w-0">
                              <span className="truncate">Billing Expenses:</span>
                              <span className="font-medium shrink-0">{formatCurrency(month.expenditures.billing)}</span>
                            </div>
                            <div className="flex justify-between gap-2 min-w-0">
                              <span className="truncate">Employee Salaries:</span>
                              <span className="font-medium shrink-0">{formatCurrency(month.expenditures.salaries)}</span>
                            </div>
                            <div className="flex justify-between gap-2 min-w-0">
                              <span className="truncate">Subscriptions:</span>
                              <span className="font-medium shrink-0">{formatCurrency(month.expenditures.subscriptions)}</span>
                            </div>
                            <div className="flex justify-between gap-2 min-w-0">
                              <span className="truncate">Outsourcing:</span>
                              <span className="font-medium shrink-0">{formatCurrency(month.expenditures.outsourcing)}</span>
                            </div>
                            <div className="flex justify-between gap-2 col-span-1 sm:col-span-2 pt-2 border-t min-w-0">
                              <span className="font-semibold truncate">Total Expenditures:</span>
                              <span className="font-bold text-red-600 shrink-0">{formatCurrency(totalExp)}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
