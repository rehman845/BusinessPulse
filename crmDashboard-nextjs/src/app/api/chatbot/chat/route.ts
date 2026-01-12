import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend-config";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");
    
    const backendUrl = getBackendUrl();
    const url = new URL(`${backendUrl}/chat`);
    if (sessionId) {
      url.searchParams.append("session_id", sessionId);
    }
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 second timeout for LLM queries
    
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      return NextResponse.json(
        { error: errorData.detail || errorData.error || `HTTP ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    if (error.name === "AbortError") {
      return NextResponse.json(
        { error: "Request timeout - the query took too long to process" },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to process chat query" },
      { status: 500 }
    );
  }
}
