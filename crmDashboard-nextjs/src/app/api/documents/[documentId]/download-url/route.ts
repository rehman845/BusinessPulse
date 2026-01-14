import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend-config";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const backendUrl = getBackendUrl();
    
    const response = await fetch(`${backendUrl}/documents/${documentId}/download-url`, {
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
      { error: error.message || "Failed to get download URL" },
      { status: 500 }
    );
  }
}

