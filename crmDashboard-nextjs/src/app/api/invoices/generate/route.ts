import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend-config";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const backendUrl = getBackendUrl();
    
    const response = await fetch(`${backendUrl}/invoices/generate`, {
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
      { error: error.message || "Failed to generate invoice" },
      { status: 500 }
    );
  }
}
