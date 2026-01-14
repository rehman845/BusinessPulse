import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend-config";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; assignmentId: string }> }
) {
  try {
    const { projectId, assignmentId } = await params;
    const backendUrl = getBackendUrl();
    const url = `${backendUrl}/projects/${projectId}/employees/${assignmentId}`;
    
    const response = await fetch(url, {
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
      { error: error.message || "Failed to remove employee" },
      { status: 500 }
    );
  }
}
