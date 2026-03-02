import { phenomlClient } from "@/lib/phenoml/client";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isSession } from "@/lib/auth-helpers";

// GET /api/fhir/construe/semantic?codesystem=LOINC&text=chest+x-ray&limit=10
export async function GET(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const { searchParams } = new URL(request.url);
    const codesystem = searchParams.get("codesystem") || "LOINC";
    const text = searchParams.get("text");
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 50) : 10;

    if (!text) {
      return NextResponse.json(
        { error: "text query parameter is required" },
        { status: 400 }
      );
    }

    const result = await phenomlClient.construe.semanticSearchEmbeddingBased(
      codesystem,
      { text, limit }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("PhenoML construe semantic search error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to search codes";
    return NextResponse.json({ error: message }, { status });
  }
}
