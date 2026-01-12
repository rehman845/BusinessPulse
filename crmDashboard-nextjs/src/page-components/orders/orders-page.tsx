"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ShoppingCart, Clock, CheckCircle, Package } from "lucide-react";
import { useOrders } from "@/hooks";
import { OrdersFilters } from "@/components/orders/orders-filters";
import { OrdersTable } from "@/components/orders/orders-table";

export function OrdersPage() {
  const {
    orders,
    allOrders,
    filters,
    sorting,
    pagination,
    pageCount,
    updateFilters,
    handleSortingChange,
    handlePaginationChange,
  } = useOrders();

  const stats = [
    {
      title: "Total Orders",
      value: allOrders.length,
      icon: ShoppingCart,
      color: "text-muted-foreground",
    },
    {
      title: "Completed",
      value: allOrders.filter((o) => o.status === "completed").length,
      icon: CheckCircle,
      color: "text-green-500",
    },
    {
      title: "Pending",
      value: allOrders.filter((o) => o.status === "pending").length,
      icon: Clock,
      color: "text-yellow-500",
    },
    {
      title: "Processing",
      value: allOrders.filter((o) => o.status === "processing").length,
      icon: Package,
      color: "text-blue-500",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground mt-2">
            Manage and track all customer orders
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Order
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {index === 0 ? "All time" : stat.title.toLowerCase()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Orders</CardTitle>
          <CardDescription>
            View and manage customer orders
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <OrdersFilters filters={filters} onFiltersChange={updateFilters} />
            <OrdersTable
              orders={orders}
              totalRows={allOrders.length}
              sorting={sorting}
              onSort={handleSortingChange}
              pagination={pagination}
              onPaginationChange={handlePaginationChange}
              pageCount={pageCount}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

