"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { teamService } from "@/api/services/team.service";
import { projectsService } from "@/api/services/projects.service";
import type { Employee, TimeEntry } from "@/types";
import type { Project } from "@/types";
import { format } from "date-fns";
import Link from "next/link";

interface EmployeeDetailPageProps {
  employeeId: string;
}

export function EmployeeDetailPage({ employeeId }: EmployeeDetailPageProps) {
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTimeEntries, setLoadingTimeEntries] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const emp = await teamService.getEmployee(employeeId);
        setEmployee(emp);
      } catch (error: any) {
        toast.error("Failed to load employee");
        router.push("/dashboard/team");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [employeeId, router]);

  useEffect(() => {
    const loadTimeEntries = async () => {
      try {
        setLoadingTimeEntries(true);
        const entries = await teamService.getEmployeeTimeEntries(employeeId);
        setTimeEntries(entries);
      } catch (error: any) {
        toast.error("Failed to load time entries");
      } finally {
        setLoadingTimeEntries(false);
      }
    };
    if (employeeId) {
      loadTimeEntries();
    }
  }, [employeeId]);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const projects = await projectsService.getProjects();
        setProjects(Array.isArray(projects) ? projects : []);
      } catch (error: any) {
        console.error("Failed to load projects", error);
      }
    };
    loadProjects();
  }, []);

  // Get unique project IDs from time entries
  const projectIds = useMemo(() => {
    return Array.from(new Set(timeEntries.map((te) => te.project_id)));
  }, [timeEntries]);

  // Get project details for projects this employee worked on
  const employeeProjects = useMemo(() => {
    return projects.filter((p) => projectIds.includes(p.id));
  }, [projects, projectIds]);

  // Group time entries by project
  const timeEntriesByProject = useMemo(() => {
    const grouped: Record<string, TimeEntry[]> = {};
    timeEntries.forEach((te) => {
      if (!grouped[te.project_id]) {
        grouped[te.project_id] = [];
      }
      grouped[te.project_id].push(te);
    });
    return grouped;
  }, [timeEntries]);

  // Calculate total hours per project
  const totalHoursByProject = useMemo(() => {
    const totals: Record<string, number> = {};
    Object.entries(timeEntriesByProject).forEach(([projectId, entries]) => {
      totals[projectId] = entries.reduce((sum, entry) => sum + entry.hours, 0);
    });
    return totals;
  }, [timeEntriesByProject]);

  const totalHours = useMemo(() => {
    return timeEntries.reduce((sum, entry) => sum + entry.hours, 0);
  }, [timeEntries]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!employee) {
    return <p className="text-muted-foreground">Employee not found.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/team")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{employee.full_name}</h1>
            <p className="text-sm text-muted-foreground">{employee.role}</p>
          </div>
        </div>
        <Badge variant={employee.is_active ? "default" : "secondary"}>
          {employee.is_active ? "Active" : "Inactive"}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Employee Information */}
        <Card>
          <CardHeader>
            <CardTitle>Employee Information</CardTitle>
            <CardDescription>Basic employee details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-1">Full Name</h4>
              <p className="text-base">{employee.full_name}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-1">Role</h4>
              <p className="text-base">{employee.role}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-1">Hourly Rate</h4>
              <p className="text-base font-mono">${employee.hourly_rate.toFixed(2)}/hr</p>
            </div>
            {employee.created_at && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-1">Member Since</h4>
                <p className="text-base">
                  {format(new Date(employee.created_at), "MMMM d, yyyy")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
            <CardDescription>Work summary</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-1">Total Hours</h4>
              <p className="text-2xl font-bold">{totalHours.toFixed(1)} hrs</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-1">Active Projects</h4>
              <p className="text-2xl font-bold">{employeeProjects.length}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-1">Time Entries</h4>
              <p className="text-2xl font-bold">{timeEntries.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projects */}
      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
          <CardDescription>Projects this employee is working on</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingTimeEntries ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : employeeProjects.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No projects assigned yet.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total Hours</TableHead>
                    <TableHead className="text-right">Time Entries</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeeProjects.map((project) => {
                    const hours = totalHoursByProject[project.id] || 0;
                    const entries = timeEntriesByProject[project.id] || [];
                    return (
                      <TableRow key={project.id}>
                        <TableCell className="font-medium">{project.projectName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{project.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{hours.toFixed(1)} hrs</TableCell>
                        <TableCell className="text-right">{entries.length}</TableCell>
                        <TableCell className="text-right">
                          <Link href={`/dashboard/projects/${project.id}`}>
                            <Button variant="ghost" size="sm">
                              View Project
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Time Entries */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Time Entries</CardTitle>
          <CardDescription>Recent work logged by this employee</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingTimeEntries ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : timeEntries.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No time entries yet.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeEntries.slice(0, 10).map((entry) => {
                    const project = projects.find((p) => p.id === entry.project_id);
                    return (
                      <TableRow key={entry.id}>
                        <TableCell>
                          {entry.work_date
                            ? format(new Date(entry.work_date), "MMM d, yyyy")
                            : "N/A"}
                        </TableCell>
                        <TableCell>{project?.projectName || entry.project_id}</TableCell>
                        <TableCell className="text-right font-mono">{entry.hours.toFixed(1)} hrs</TableCell>
                        <TableCell className="max-w-md truncate">
                          {entry.description || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
