import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend-config";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; questionnaireId: string }> }
) {
  try {
    const { id, questionnaireId } = await params;
    const backendUrl = getBackendUrl();
    const response = await fetch(
      `${backendUrl}/customers/${id}/questionnaire/${questionnaireId}/pdf`,
      {
        method: "GET",
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `HTTP ${response.status}: ${response.statusText}` },
        { status: response.status }
      );
    }

    // Get the PDF blob and return it
    const blob = await response.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="questionnaire_${questionnaireId}.pdf"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to download questionnaire PDF" },
      { status: 500 }
    );
  }
}
