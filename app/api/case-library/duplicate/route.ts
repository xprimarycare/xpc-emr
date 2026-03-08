import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isSession } from "@/lib/auth-helpers";
import { clonePatient } from "@/lib/services/fhir-clone-service";

// POST /api/case-library/duplicate
// Admin duplicates a patient with selected resource types
export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (!isSession(authResult)) return authResult;

  if (authResult.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { sourcePatientFhirId, resourceTypes, overrideName, overrideBirthDate, overrideGender } = await request.json();

    if (!sourcePatientFhirId?.trim()) {
      return NextResponse.json(
        { error: "sourcePatientFhirId is required" },
        { status: 400 }
      );
    }
    if (!Array.isArray(resourceTypes)) {
      return NextResponse.json(
        { error: "resourceTypes must be an array" },
        { status: 400 }
      );
    }

    const result = await clonePatient({
      sourcePatientFhirId: sourcePatientFhirId.trim(),
      resourceTypes,
      overrideName,
      overrideBirthDate,
      overrideGender,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Duplicate API error:", error);
    return NextResponse.json(
      { error: "Failed to duplicate patient" },
      { status: 500 }
    );
  }
}
