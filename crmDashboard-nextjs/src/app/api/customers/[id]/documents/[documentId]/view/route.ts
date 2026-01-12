import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend-config";

/**
 * Document View API Route (SSR Proxy)
 * Proxies document view requests to the backend for inline viewing
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    const { id: customerId, documentId } = await params;
    const backendUrl = getBackendUrl();
    
    const response = await fetch(
      `${backendUrl}/customers/${customerId}/documents/${documentId}/view`,
      {
        method: "GET",
      }
    );

    if (!response.ok) {
      const errorData = await response.text().catch(() => response.statusText);
      return NextResponse.json(
        { error: errorData || `HTTP ${response.status}` },
        { status: response.status }
      );
    }

    // Get the file blob
    const blob = await response.blob();
    
    // Get content type from response
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    
    // Get filename from Content-Disposition header
    const contentDisposition = response.headers.get("content-disposition") || "";
    
    // Return the file with proper headers for inline viewing
    return new NextResponse(blob, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to view document" },
      { status: 500 }
    );
  }
}
