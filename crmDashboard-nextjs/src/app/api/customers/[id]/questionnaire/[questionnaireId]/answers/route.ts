import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend-config";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; questionnaireId: string } }
) {
  try {
    const { id, questionnaireId } = params;
    const body = await request.json();
    
    const backendUrl = getBackendUrl();
    const response = await fetch(
      `${backendUrl}/customers/${id}/questionnaire/${questionnaireId}/answers`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

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
      { error: error.message || "Failed to submit answers" },
      { status: 500 }
    );
  }
}
