import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend-config";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const due_before = searchParams.get("due_before");
    const overdue = searchParams.get("overdue");
    
    const backendUrl = getBackendUrl();
    const url = new URL(`${backendUrl}/notion/tasks`);
    
    if (status) url.searchParams.append("status", status);
    if (due_before) url.searchParams.append("due_before", due_before);
    if (overdue) url.searchParams.append("overdue", overdue);
    
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      return NextResponse.json(
        { error: error.detail || `HTTP ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const due_before = searchParams.get("due_before");
    const overdue = searchParams.get("overdue");
    
    const backendUrl = getBackendUrl();
    const url = new URL(`${backendUrl}/notion/sync`);
    
    if (status) url.searchParams.append("status", status);
    if (due_before) url.searchParams.append("due_before", due_before);
    if (overdue) url.searchParams.append("overdue", overdue);
    
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      return NextResponse.json(
        { error: error.detail || `HTTP ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to sync tasks" },
      { status: 500 }
    );
  }
}

