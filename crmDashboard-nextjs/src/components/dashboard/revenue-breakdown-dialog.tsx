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
      <DialogContent className="!max-w-[85vw] sm:!max-w-4xl lg:!max-w-5xl w-full max-h-[90vh] overflow-y-auto">
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
                <CardContent className="min-w-0">
                  <div className="text-2xl font-bold text-green-600 whitespace-nowrap overflow-hidden text-ellipsis">
                    {formatCurrency(totalProfits)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Expenditures</CardTitle>
                  <TrendingDown className="h-4 w-4 text-red-500 shrink-0" />
                </CardHeader>
                <CardContent className="min-w-0">
                  <div className="text-2xl font-bold text-red-600 whitespace-nowrap overflow-hidden text-ellipsis">
                    {formatCurrency(totalExpenditures)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Net Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardHeader>
                <CardContent className="min-w-0">
                  <div className={`text-2xl font-bold whitespace-nowrap overflow-hidden text-ellipsis ${grandTotal >= 0 ? "text-green-600" : "text-red-600"}`}>
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
                        <CardTitle className="text-lg font-semibold">{month.month}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Profits and Net */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">Profits (Paid Invoices)</p>
                            <p className="text-2xl font-bold text-green-600 whitespace-nowrap">
                              {formatCurrency(month.profits)}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">Net Revenue</p>
                            <p className={`text-2xl font-bold whitespace-nowrap ${month.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {formatCurrency(month.net)}
                            </p>
                          </div>
                        </div>

                        {/* Expenditures Breakdown */}
                        <div className="space-y-3 pt-4 border-t">
                          <p className="text-sm font-semibold text-muted-foreground mb-3">Expenditures</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex justify-between items-center gap-4 py-2">
                              <span className="text-sm text-muted-foreground">Billing Expenses</span>
                              <span className="text-sm font-semibold whitespace-nowrap">{formatCurrency(month.expenditures.billing)}</span>
                            </div>
                            <div className="flex justify-between items-center gap-4 py-2">
                              <span className="text-sm text-muted-foreground">Employee Salaries</span>
                              <span className="text-sm font-semibold whitespace-nowrap">{formatCurrency(month.expenditures.salaries)}</span>
                            </div>
                            <div className="flex justify-between items-center gap-4 py-2">
                              <span className="text-sm text-muted-foreground">Subscriptions</span>
                              <span className="text-sm font-semibold whitespace-nowrap">{formatCurrency(month.expenditures.subscriptions)}</span>
                            </div>
                            <div className="flex justify-between items-center gap-4 py-2">
                              <span className="text-sm text-muted-foreground">Outsourcing</span>
                              <span className="text-sm font-semibold whitespace-nowrap">{formatCurrency(month.expenditures.outsourcing)}</span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center gap-4 pt-3 mt-3 border-t">
                            <span className="text-base font-bold">Total Expenditures</span>
                            <span className="text-base font-bold text-red-600 whitespace-nowrap">{formatCurrency(totalExp)}</span>
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
