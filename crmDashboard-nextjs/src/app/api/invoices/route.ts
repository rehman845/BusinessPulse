import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend-config";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const projectId = searchParams.get("project_id");
    const customerId = searchParams.get("customer_id");
    
    const backendUrl = getBackendUrl();
    const url = new URL(`${backendUrl}/invoices`);
    if (status) url.searchParams.append("status", status);
    if (projectId) url.searchParams.append("project_id", projectId);
    if (customerId) url.searchParams.append("customer_id", customerId);
    
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      next: { revalidate: 5 },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      return NextResponse.json(
        { error: error.detail || `HTTP ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const res = NextResponse.json(data);
    res.headers.set("Cache-Control", "public, s-maxage=5, stale-while-revalidate=10");
    return res;
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const backendUrl = getBackendUrl();
    
    const response = await fetch(`${backendUrl}/invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
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
      { error: error.message || "Failed to create invoice" },
      { status: 500 }
    );
  }
}
