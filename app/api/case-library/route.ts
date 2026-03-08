import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { phenomlClient } from "@/lib/phenoml/client";
import { mapFhirBundleToEncounters } from "@/lib/phenoml/fhir-mapper";
import { UserRole } from "@/lib/constants/case-status";

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

interface PatientInfo {
  name: string;
  age: string;
  sex: string;
}

async function fetchPatientInfo(patientFhirId: string): Promise<PatientInfo> {
  if (!providerId) return { name: "Unknown", age: "", sex: "" };
  try {
    const result = await phenomlClient.fhir.search(providerId, "Patient", {}, {
      queryParams: { _id: patientFhirId, _count: "1" },
    });
    const bundle = result as any;
    const patient = bundle?.entry?.[0]?.resource;
    const nameEntry = patient?.name?.[0];
    const given = nameEntry?.given?.join(" ") || "";
    const family = nameEntry?.family || "";
    const name = [given, family].filter(Boolean).join(" ") || "Unknown";

    let age = "";
    if (patient?.birthDate) {
      const birthYear = new Date(patient.birthDate).getFullYear();
      age = String(new Date().getFullYear() - birthYear);
    }
    const sex = patient?.gender
      ? patient.gender.charAt(0).toUpperCase()
      : "";

    return { name, age, sex };
  } catch {
    return { name: "Unknown", age: "", sex: "" };
  }
}

async function fetchPatientName(patientFhirId: string): Promise<string> {
  return (await fetchPatientInfo(patientFhirId)).name;
}

function sortBySignedAtDesc<T extends { signedAt?: string }>(a: T, b: T): number {
  return (b.signedAt ? new Date(b.signedAt).getTime() : 0) -
         (a.signedAt ? new Date(a.signedAt).getTime() : 0);
}

// GET /api/case-library?view=...
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (!isSession(authResult)) return authResult;

  const session = authResult;
  const userId = session.user.id;
  const isAdmin = session.user.role === UserRole.ADMIN;

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
        include: {
          _count: { select: { patients: true } },
          patients: { select: { patientFhirId: true } },
        },
        orderBy: { name: "asc" },
      });

      // Fetch signed note counts per user in parallel
      const results = await Promise.all(
        users.map(async (u) => {
          let noteCount = 0;
          if (u.patients.length > 0) {
            const allEncounters = (
              await Promise.all(
                u.patients.map((p) => fetchPatientEncounters(p.patientFhirId))
              )
            ).flat();
            noteCount = allEncounters.filter((e) => e.isSigned).length;
          }
          return {
            id: u.id,
            name: u.name,
            email: u.email,
            institution: u.institution,
            patientCount: u._count.patients,
            noteCount,
          };
        })
      );

      return NextResponse.json(results);
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
          const [patientInfo, encounters] = await Promise.all([
            fetchPatientInfo(a.patientFhirId),
            fetchPatientEncounters(a.patientFhirId),
          ]);
          const signedCount = encounters.filter((e) => e.isSigned).length;
          // Most recent encounter for note preview and CC
          const mostRecent = encounters
            .sort((x, y) => (y.date || "").localeCompare(x.date || ""))[0];
          const notePreview = mostRecent?.noteText
            ? mostRecent.noteText.replace(/<[^>]*>/g, "").slice(0, 120)
            : "";
          return {
            patientFhirId: a.patientFhirId,
            patientName: patientInfo.name,
            patientAge: patientInfo.age,
            patientSex: patientInfo.sex,
            signedEncounterCount: signedCount,
            encounterType: mostRecent?.classDisplay || "",
            notePreview,
            status: a.status,
            assignedBy: a.assignedBy,
            encounterFhirId: a.encounterFhirId,
          };
        })
      );

      return NextResponse.json(results);
    }

    // --- All assignments (admin only) ---
    if (view === "assignments") {
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const assignments = await prisma.userPatient.findMany({
        include: {
          user: { select: { name: true, email: true } },
        },
        orderBy: { assignedAt: "desc" },
      });

      // Resolve patient names in parallel
      const patientIds = [...new Set(assignments.map((a) => a.patientFhirId))];
      const nameMap = new Map<string, string>();
      await Promise.all(
        patientIds.map(async (pid) => {
          nameMap.set(pid, await fetchPatientName(pid));
        })
      );

      // Resolve assigner names
      const assignerIds = [
        ...new Set(assignments.map((a) => a.assignedBy).filter(Boolean)),
      ] as string[];
      const assignerMap = new Map<string, string>();
      if (assignerIds.length > 0) {
        const assigners = await prisma.user.findMany({
          where: { id: { in: assignerIds } },
          select: { id: true, name: true, email: true },
        });
        for (const a of assigners) {
          assignerMap.set(a.id, a.name || a.email);
        }
      }

      return NextResponse.json(
        assignments.map((a) => ({
          id: a.id,
          patientFhirId: a.patientFhirId,
          patientName: nameMap.get(a.patientFhirId) || "Unknown",
          clinicianId: a.userId,
          clinicianName: a.user.name || a.user.email,
          status: a.status,
          assignedAt: a.assignedAt.toISOString(),
          assignedByName: a.assignedBy
            ? assignerMap.get(a.assignedBy) || "Unknown"
            : null,
          encounterFhirId: a.encounterFhirId,
        }))
      );
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
        .sort(sortBySignedAtDesc)
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
        orderBy: { assignedAt: "desc" },
        take: 100,
      });
      const uniquePatientIds = [
        ...new Set(allAssignments.map((a) => a.patientFhirId)),
      ].slice(0, 50);

      const allEncounters = (
        await Promise.all(
          uniquePatientIds.map((pid) => fetchPatientEncounters(pid))
        )
      ).flat();

      const signedEncounters = allEncounters
        .filter((e) => e.isSigned)
        .sort(sortBySignedAtDesc)
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
      { error: "Invalid view parameter. Use: users, user-patients, patient-encounters, recent-activity, or assignments" },
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
