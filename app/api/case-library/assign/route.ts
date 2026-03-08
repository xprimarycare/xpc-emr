import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { cloneEncounter } from "@/lib/services/fhir-clone-service";
import { CaseStatus } from "@/lib/constants/case-status";

// POST /api/case-library/assign
// Admin assigns a patient (optionally with encounter clone) to one or more clinicians
export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (!isSession(authResult)) return authResult;

  if (authResult.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const {
      patientFhirId,
      clinicianIds,
      encounterFhirId,
      includeNoteText = true,
    } = await request.json();

    if (!patientFhirId?.trim()) {
      return NextResponse.json(
        { error: "patientFhirId is required" },
        { status: 400 }
      );
    }
    if (!Array.isArray(clinicianIds) || clinicianIds.length === 0) {
      return NextResponse.json(
        { error: "clinicianIds must be a non-empty array" },
        { status: 400 }
      );
    }

    // Verify all clinicians exist and have completed onboarding
    const clinicians = await prisma.user.findMany({
      where: { id: { in: clinicianIds }, onboardingComplete: true },
      select: { id: true },
    });
    const validIds = new Set(clinicians.map((c) => c.id));
    const invalidIds = clinicianIds.filter((id: string) => !validIds.has(id));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: `Unknown or unonboarded clinicians: ${invalidIds.join(", ")}` },
        { status: 400 }
      );
    }

    const results = await Promise.all(
      clinicianIds.map(async (clinicianId: string) => {
        try {
          let clonedEncounterFhirId: string | undefined;

          // Clone encounter if provided
          if (encounterFhirId) {
            const cloneResult = await cloneEncounter({
              sourcePatientFhirId: patientFhirId.trim(),
              sourceEncounterFhirId: encounterFhirId.trim(),
              targetPatientFhirId: patientFhirId.trim(),
              includeNoteText,
            });
            if (cloneResult.error) {
              return { clinicianId, success: false as const, error: cloneResult.error };
            }
            clonedEncounterFhirId = cloneResult.encounterFhirId;
          }

          // Create/update assignment
          const data = {
            status: CaseStatus.WAITING_ROOM,
            assignedBy: authResult.user.id,
            encounterFhirId: clonedEncounterFhirId || undefined,
            sourceEncounterFhirId: encounterFhirId?.trim() || undefined,
            sourcePatientFhirId: patientFhirId.trim(),
            includeNoteText,
          };

          await prisma.userPatient.upsert({
            where: {
              userId_patientFhirId: {
                userId: clinicianId,
                patientFhirId: patientFhirId.trim(),
              },
            },
            update: data,
            create: {
              userId: clinicianId,
              patientFhirId: patientFhirId.trim(),
              ...data,
            },
          });

          return {
            clinicianId,
            success: true as const,
            encounterFhirId: clonedEncounterFhirId,
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          console.error(`Assignment failed for clinician ${clinicianId}:`, err);
          return { clinicianId, success: false as const, error: message };
        }
      })
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Assignment API error:", error);
    return NextResponse.json(
      { error: "Failed to process assignments" },
      { status: 500 }
    );
  }
}
