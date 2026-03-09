import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isSession } from "@/lib/auth-helpers";
import { isLocalBackend } from "@/lib/emr-backend";
import { prismaClinical } from "@/lib/prisma-clinical";
import { generateFakePatientName, generateFakePatientDob } from "@/lib/services/fhir-clone-service";

// GET /api/case-library/duplicate/preview?sourcePatientFhirId=<id>
// Admin-only: generates a fake name + DOB for a patient without creating anything.
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (!isSession(authResult)) return authResult;

  if (authResult.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sourcePatientFhirId = request.nextUrl.searchParams.get("sourcePatientFhirId")?.trim();
  if (!sourcePatientFhirId) {
    return NextResponse.json({ error: "sourcePatientFhirId is required" }, { status: 400 });
  }

  try {
    let gender: string;
    let birthDate: string;

    if (isLocalBackend()) {
      const patient = await prismaClinical.patient.findUnique({
        where: { id: sourcePatientFhirId },
      });
      if (!patient) {
        return NextResponse.json({ error: "Source patient not found" }, { status: 404 });
      }
      gender = patient.sex || "unknown";
      birthDate = patient.dob || "";
    } else {
      const { phenomlClient } = await import("@/lib/phenoml/client");
      const providerId = process.env.PHENOML_FHIR_PROVIDER_ID;
      if (!providerId) {
        return NextResponse.json({ error: "FHIR provider not configured" }, { status: 500 });
      }

      const bundle = await phenomlClient.fhir.search(
        providerId,
        "Patient",
        {},
        { queryParams: { _id: sourcePatientFhirId, _count: "1" } }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ) as any;

      const sourcePatient = bundle?.entry?.[0]?.resource;
      if (!sourcePatient) {
        return NextResponse.json({ error: "Source patient not found" }, { status: 404 });
      }
      gender = sourcePatient.gender ?? "unknown";
      birthDate = sourcePatient.birthDate ?? "";
    }

    const { given, family } = generateFakePatientName(gender);
    const fakeDob = birthDate ? generateFakePatientDob(birthDate) : "";

    return NextResponse.json({ given, family, birthDate: fakeDob });
  } catch (error) {
    console.error("Duplicate preview error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate preview" },
      { status: 500 }
    );
  }
}
