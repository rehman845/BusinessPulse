"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, FileText, Download, Eye } from "lucide-react";

// Sample active agreements data
const activeAgreements = [
  {
    id: "AGR-001",
    title: "Service Agreement - Tech Corp",
    client: "Tech Corp Inc.",
    startDate: "2024-01-15",
    endDate: "2025-01-15",
    value: "$50,000",
    status: "active",
  },
  {
    id: "AGR-002",
    title: "Partnership Agreement - Global Solutions",
    client: "Global Solutions Ltd",
    startDate: "2024-03-01",
    endDate: "2025-03-01",
    value: "$120,000",
    status: "active",
  },
];

export function AgreementsActivePage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredAgreements = activeAgreements.filter((agreement) => {
    return agreement.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agreement.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agreement.id.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Active Agreements</h1>
          <p className="text-muted-foreground mt-2">
            View all currently active agreements
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Agreement
        </Button>
      </div>

      {/* Stats Card */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agreements</CardTitle>
            <FileText className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeAgreements.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$170,000</div>
            <p className="text-xs text-muted-foreground mt-1">
              Combined agreement value
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Agreements</CardTitle>
          <CardDescription>
            All currently active agreements
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search agreements..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agreement ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAgreements.length > 0 ? (
                  filteredAgreements.map((agreement) => (
                    <TableRow key={agreement.id}>
                      <TableCell className="font-medium">{agreement.id}</TableCell>
                      <TableCell>{agreement.title}</TableCell>
                      <TableCell>{agreement.client}</TableCell>
                      <TableCell>{agreement.startDate}</TableCell>
                      <TableCell>{agreement.endDate}</TableCell>
                      <TableCell>{agreement.value}</TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                          Active
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      No active agreements found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

