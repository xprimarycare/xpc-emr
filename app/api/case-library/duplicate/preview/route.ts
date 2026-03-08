import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isSession } from "@/lib/auth-helpers";
import { phenomlClient } from "@/lib/phenoml/client";
import { generateFakePatientName, generateFakePatientDob } from "@/lib/services/fhir-clone-service";

const providerId = process.env.PHENOML_FHIR_PROVIDER_ID;

// GET /api/case-library/duplicate/preview?sourcePatientFhirId=<id>
// Admin-only: generates a fake name + DOB for a patient without creating anything.
// Used to preview proposed values before confirming duplication.
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (!isSession(authResult)) return authResult;

  if (authResult.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!providerId) {
    return NextResponse.json({ error: "FHIR provider not configured" }, { status: 500 });
  }

  const sourcePatientFhirId = request.nextUrl.searchParams.get("sourcePatientFhirId")?.trim();
  if (!sourcePatientFhirId) {
    return NextResponse.json({ error: "sourcePatientFhirId is required" }, { status: 400 });
  }

  try {
    const bundle = await phenomlClient.fhir.search(
      providerId,
      "Patient",
      {},
      { queryParams: { _id: sourcePatientFhirId, _count: "1" } }
    ) as any;

    const sourcePatient = bundle?.entry?.[0]?.resource;
    if (!sourcePatient) {
      return NextResponse.json({ error: "Source patient not found" }, { status: 404 });
    }

    const { given, family } = generateFakePatientName(sourcePatient.gender ?? "unknown");
    const birthDate = sourcePatient.birthDate
      ? generateFakePatientDob(sourcePatient.birthDate)
      : "";

    return NextResponse.json({ given, family, birthDate });
  } catch (error) {
    console.error("Duplicate preview error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate preview" },
      { status: 500 }
    );
  }
}
