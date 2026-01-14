import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend-config";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ expenseId: string }> }
) {
  try {
    const { expenseId } = await params;
    const backendUrl = getBackendUrl();
    
    const response = await fetch(`${backendUrl}/billing/expenses/${expenseId}`, {
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
      { error: error.message || "Failed to fetch expense" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ expenseId: string }> }
) {
  try {
    const { expenseId } = await params;
    const body = await request.json();
    const backendUrl = getBackendUrl();
    
    const response = await fetch(`${backendUrl}/billing/expenses/${expenseId}`, {
      method: "PATCH",
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
      { error: error.message || "Failed to update expense" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ expenseId: string }> }
) {
  try {
    const { expenseId } = await params;
    const backendUrl = getBackendUrl();
    
    const response = await fetch(`${backendUrl}/billing/expenses/${expenseId}`, {
      method: "DELETE",
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
      { error: error.message || "Failed to delete expense" },
      { status: 500 }
    );
  }
}
