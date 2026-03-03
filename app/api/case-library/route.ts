import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { phenomlClient } from "@/lib/phenoml/client";
import { mapFhirBundleToEncounters } from "@/lib/phenoml/fhir-mapper";

const providerId = process.env.PHENOML_FHIR_PROVIDER_ID;

async function fetchPatientEncounters(patientFhirId: string) {
  if (!providerId) return [];

  const [encBundle, ciBundle] = await Promise.all([
    phenomlClient.fhir.search(providerId, "Encounter", {}, {
      queryParams: { subject: `Patient/${patientFhirId}`, _count: "100" },
    }),
    phenomlClient.fhir.search(providerId, "ClinicalImpression", {}, {
      queryParams: { subject: `Patient/${patientFhirId}`, _count: "100" },
    }),
  ]);

  return mapFhirBundleToEncounters(encBundle as any, ciBundle as any);
}

async function fetchPatientName(patientFhirId: string): Promise<string> {
  if (!providerId) return "Unknown";
  try {
    const result = await phenomlClient.fhir.search(providerId, "Patient", {}, {
      queryParams: { _id: patientFhirId, _count: "1" },
    });
    const bundle = result as any;
    const patient = bundle?.entry?.[0]?.resource;
    const name = patient?.name?.[0];
    if (!name) return "Unknown";
    const given = name.given?.join(" ") || "";
    const family = name.family || "";
    return [given, family].filter(Boolean).join(" ") || "Unknown";
  } catch {
    return "Unknown";
  }
}

// GET /api/case-library?view=...
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (!isSession(authResult)) return authResult;

  const session = authResult;
  const userId = session.user.id;
  const isAdmin = session.user.role === "admin";

  if (!providerId) {
    return NextResponse.json(
      { error: "FHIR provider not configured" },
      { status: 500 }
    );
  }

  const view = request.nextUrl.searchParams.get("view");

  try {
    // --- Users list (admin only) ---
    if (view === "users") {
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const users = await prisma.user.findMany({
        where: { onboardingComplete: true },
        include: { _count: { select: { patients: true } } },
        orderBy: { name: "asc" },
      });

      return NextResponse.json(
        users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          institution: u.institution,
          patientCount: u._count.patients,
        }))
      );
    }

    // --- User's patients with signed encounter counts ---
    if (view === "user-patients") {
      const targetUserId = request.nextUrl.searchParams.get("userId");
      if (!targetUserId) {
        return NextResponse.json(
          { error: "userId parameter is required" },
          { status: 400 }
        );
      }
      if (!isAdmin && targetUserId !== userId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const assignments = await prisma.userPatient.findMany({
        where: { userId: targetUserId },
      });

      const results = await Promise.all(
        assignments.map(async (a) => {
          const [patientName, encounters] = await Promise.all([
            fetchPatientName(a.patientFhirId),
            fetchPatientEncounters(a.patientFhirId),
          ]);
          const signedCount = encounters.filter((e) => e.isSigned).length;
          return {
            patientFhirId: a.patientFhirId,
            patientName,
            signedEncounterCount: signedCount,
          };
        })
      );

      return NextResponse.json(results);
    }

    // --- Signed encounters for a specific patient ---
    if (view === "patient-encounters") {
      const patientFhirId = request.nextUrl.searchParams.get("patientFhirId");
      if (!patientFhirId) {
        return NextResponse.json(
          { error: "patientFhirId parameter is required" },
          { status: 400 }
        );
      }

      // Access check: admin can view any, regular user must own the patient
      if (!isAdmin) {
        const assignment = await prisma.userPatient.findUnique({
          where: {
            userId_patientFhirId: { userId, patientFhirId },
          },
        });
        if (!assignment) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }

      const encounters = await fetchPatientEncounters(patientFhirId);
      const signed = encounters
        .filter((e) => e.isSigned)
        .sort((a, b) => {
          const da = a.signedAt ? new Date(a.signedAt).getTime() : 0;
          const db = b.signedAt ? new Date(b.signedAt).getTime() : 0;
          return db - da;
        })
        .map((e) => ({
          encounterFhirId: e.encounterFhirId,
          date: e.date,
          classDisplay: e.classDisplay,
          signedAt: e.signedAt,
          signedBy: e.signedBy,
          notePreview: e.noteText?.slice(0, 120) || "",
        }));

      return NextResponse.json(signed);
    }

    // --- Recent activity (admin only) ---
    if (view === "recent-activity") {
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const allAssignments = await prisma.userPatient.findMany({
        select: { patientFhirId: true },
      });
      const uniquePatientIds = [
        ...new Set(allAssignments.map((a) => a.patientFhirId)),
      ];

      const allEncounters = (
        await Promise.all(
          uniquePatientIds.map((pid) => fetchPatientEncounters(pid))
        )
      ).flat();

      const signedEncounters = allEncounters
        .filter((e) => e.isSigned)
        .sort((a, b) => {
          const da = a.signedAt ? new Date(a.signedAt).getTime() : 0;
          const db = b.signedAt ? new Date(b.signedAt).getTime() : 0;
          return db - da;
        })
        .slice(0, 50);

      // Resolve patient names in parallel
      const patientIds = [...new Set(signedEncounters.map((e) => e.patientFhirId))];
      const nameMap = new Map<string, string>();
      await Promise.all(
        patientIds.map(async (pid) => {
          nameMap.set(pid, await fetchPatientName(pid));
        })
      );

      return NextResponse.json(
        signedEncounters.map((e) => ({
          encounterFhirId: e.encounterFhirId,
          patientFhirId: e.patientFhirId,
          patientName: nameMap.get(e.patientFhirId) || "Unknown",
          signedAt: e.signedAt,
          signedBy: e.signedBy,
          classDisplay: e.classDisplay,
        }))
      );
    }

    return NextResponse.json(
      { error: "Invalid view parameter. Use: users, user-patients, patient-encounters, or recent-activity" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Case library API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch case library data" },
      { status: 500 }
    );
  }
}
