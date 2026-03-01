import { phenomlClient } from "@/lib/phenoml/client";
import { NextRequest, NextResponse } from "next/server";

// POST /api/fhir/lang2fhir - Parse natural language to FHIR resource (no write)
export async function POST(request: NextRequest) {
  try {
    const { text, resource, version } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: "text is required" },
        { status: 400 }
      );
    }

    const result = await phenomlClient.lang2Fhir.create({
      text,
      resource: resource || "medicationrequest",
      version: version || "R4",
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("PhenoML lang2fhir error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to parse text";
    return NextResponse.json({ error: message }, { status });
  }
}
