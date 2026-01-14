"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  DollarSign, 
  FileText, 
  ShoppingCart, 
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { invoicesService } from "@/api/services";
import { formatCurrency } from "@/utils/format";
import { RevenueBreakdownDialog } from "@/components/dashboard/revenue-breakdown-dialog";
import type { Invoice } from "@/types";

export function DashboardPage() {
  const [revenueBreakdownOpen, setRevenueBreakdownOpen] = useState(false);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [loadingRevenue, setLoadingRevenue] = useState(true);

  useEffect(() => {
    loadRevenue();
  }, []);

  const loadRevenue = async () => {
    try {
      setLoadingRevenue(true);
      const invoices = await invoicesService.getInvoices({ status: "paid" });
      const revenue = invoices.reduce((sum, invoice: Invoice) => {
        return sum + (invoice.total || invoice.totalAmount || 0);
      }, 0);
      setTotalRevenue(revenue);
    } catch (error) {
      console.error("Failed to load revenue", error);
    } finally {
      setLoadingRevenue(false);
    }
  };

  // Sample statistics
  const stats = [
    {
      title: "Total Revenue",
      value: loadingRevenue ? "Loading..." : formatCurrency(totalRevenue),
      change: "+0%",
      trend: "up" as const,
      icon: DollarSign,
      clickable: true,
    },
    {
      title: "Active Agreements",
      value: "0",
      change: "+0%",
      trend: "up" as const,
      icon: FileText,
      clickable: false,
    },
    {
      title: "Pending Orders",
      value: "0",
      change: "-0%",
      trend: "down" as const,
      icon: ShoppingCart,
      clickable: false,
    },
    {
      title: "Growth Rate",
      value: "0%",
      change: "+0%",
      trend: "up" as const,
      icon: TrendingUp,
      clickable: false,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Welcome to your Dashboard
          </p>
        </div>
        <Button>
          <FileText className="mr-2 h-4 w-4" />
          Generate Report
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Card 
            key={index}
            className={stat.clickable ? "cursor-pointer hover:shadow-md transition-shadow" : ""}
            onClick={() => stat.clickable && setRevenueBreakdownOpen(true)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                {stat.trend === "up" ? (
                  <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
                )}
                <span className={stat.trend === "up" ? "text-green-500" : "text-red-500"}>
                  {stat.change}
                </span>
                <span className="ml-1">from last month</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Your latest transactions and updates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-center h-32 border-2 border-dashed rounded-lg">
                <p className="text-sm text-muted-foreground">
                  No recent activity to display
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks and shortcuts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start">
              <FileText className="mr-2 h-4 w-4" />
              Create Agreement
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <ShoppingCart className="mr-2 h-4 w-4" />
              New Order
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <FileText className="mr-2 h-4 w-4" />
              Create Invoice
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Overview Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Overview</CardTitle>
            <CardDescription>Monthly revenue trends</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
              <p className="text-sm text-muted-foreground">
                Chart placeholder - Add your data here
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order Status</CardTitle>
            <CardDescription>Distribution of order statuses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
              <p className="text-sm text-muted-foreground">
                Chart placeholder - Add your data here
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Breakdown Dialog */}
      <RevenueBreakdownDialog 
        open={revenueBreakdownOpen}
        onOpenChange={setRevenueBreakdownOpen}
      />
    </div>
  );
}
