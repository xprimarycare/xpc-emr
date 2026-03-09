import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { isLocalBackend } from "@/lib/emr-backend";
import { prismaClinical } from "@/lib/prisma-clinical";

// Helper: convert a local Patient row into a FHIR-bundle-shaped entry
// so the existing UI (parseFhirBundle, CaseLibraryPanel, etc.) works unchanged.
function localPatientToFhirEntry(p: { id: string; name: string; mrn: string; dob: string; sex: string }) {
  const nameParts = p.name.trim().split(/\s+/);
  const family = nameParts.length > 1 ? nameParts.pop()! : "";
  const given = nameParts;
  return {
    resource: {
      resourceType: "Patient",
      id: p.id,
      name: [{ given, family, text: p.name }],
      gender: p.sex || undefined,
      birthDate: p.dob || undefined,
      identifier: p.mrn ? [{ value: p.mrn, type: { coding: [{ code: "MR" }] } }] : [],
    },
  };
}

// GET /api/fhir/patient - Search patients
// GET /api/fhir/patient?id=123 - Get specific patient
export async function GET(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const searchParams = request.nextUrl.searchParams;
    const patientId = searchParams.get("id");
    const name = searchParams.get("name");

    // ── Local backend ──
    if (isLocalBackend()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {};
      if (patientId) where.id = patientId;
      if (name) where.name = { contains: name, mode: "insensitive" };

      const rows = await prismaClinical.patient.findMany({
        where,
        take: 200,
        orderBy: { name: "asc" },
      });

      const bundle = {
        resourceType: "Bundle",
        type: "searchset",
        total: rows.length,
        entry: rows.map(localPatientToFhirEntry),
      };
      return NextResponse.json(bundle);
    }

    // ── Medplum / FHIR backend ──
    const { phenomlClient } = await import("@/lib/phenoml/client");
    const providerId = process.env.PHENOML_FHIR_PROVIDER_ID;

    if (!providerId) {
      return NextResponse.json(
        { error: "FHIR provider not configured" },
        { status: 500 }
      );
    }

    const fhirParams: Record<string, string> = { _count: "200" };
    if (patientId) fhirParams._id = patientId;
    if (name) fhirParams.name = name;

    const result = await phenomlClient.fhir.search(
      providerId,
      "Patient",
      {},
      { queryParams: fhirParams }
    );

    // Fallback: filter locally in case PhenoML SDK doesn't forward params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bundle = result as any;
    if (bundle?.entry) {
      if (patientId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        bundle.entry = bundle.entry.filter((entry: any) => entry.resource?.id === patientId);
      }
      if (name) {
        const query = name.toLowerCase();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        bundle.entry = bundle.entry.filter((entry: any) => {
          const resource = entry.resource;
          if (!resource?.name) return false;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return resource.name.some((n: any) => {
            const parts = [n.text, n.family, ...(n.given || [])].filter(Boolean);
            return parts.some((p: string) => p.toLowerCase().includes(query));
          });
        });
      }
      bundle.total = bundle.entry.length;
    }

    return NextResponse.json(bundle);
  } catch (error) {
    console.error("FHIR Patient search error:", error);
    return NextResponse.json({ error: "Failed to fetch patients" }, { status: 500 });
  }
}

// POST /api/fhir/patient - Create a new patient
export async function POST(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const { name, gender, dateOfBirth } = await request.json();

    if (!name) {
      return NextResponse.json({ error: "Patient name is required" }, { status: 400 });
    }

    // ── Local backend ──
    if (isLocalBackend()) {
      const patient = await prismaClinical.patient.create({
        data: {
          name: name.trim(),
          sex: gender || "",
          dob: dateOfBirth || "",
        },
      });
      return NextResponse.json({ fhirId: patient.id });
    }

    // ── Medplum / FHIR backend ──
    const { phenomlClient } = await import("@/lib/phenoml/client");
    const providerId = process.env.PHENOML_FHIR_PROVIDER_ID;
    if (!providerId) {
      return NextResponse.json({ error: "FHIR provider not configured" }, { status: 500 });
    }

    const nameParts = name.trim().split(/\s+/);
    const family = nameParts.length > 1 ? nameParts.pop()! : "";
    const given = nameParts;

    const body = {
      resourceType: "Patient",
      name: [{ given: given.length > 0 ? given : undefined, family: family || undefined }],
      gender: gender || undefined,
      birthDate: dateOfBirth || undefined,
    };

    const result = await phenomlClient.fhir.create(providerId, "Patient", { body });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fhirId = (result as any)?.id;
    if (!fhirId) {
      return NextResponse.json({ error: "Patient created but no ID returned" }, { status: 500 });
    }

    return NextResponse.json({ fhirId });
  } catch (error) {
    console.error("FHIR Patient create error:", error);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const status = (error as any)?.statusCode || 500;
    const message = error instanceof Error ? error.message : "Failed to create patient";
    return NextResponse.json({ error: message }, { status });
  }
}

// PUT /api/fhir/patient - Upsert (create or update) a patient
export async function PUT(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const body = await request.json();

    // ── Local backend ──
    if (isLocalBackend()) {
      const { id, name, gender, birthDate } = body;
      if (!id) {
        return NextResponse.json({ error: "Patient ID is required" }, { status: 400 });
      }
      // Accept either FHIR-shaped or flat fields
      let patientName = name;
      if (Array.isArray(name)) {
        const n = name[0];
        patientName = [n?.given?.join(" "), n?.family].filter(Boolean).join(" ");
      }
      const patient = await prismaClinical.patient.update({
        where: { id },
        data: {
          ...(patientName ? { name: patientName } : {}),
          ...(gender ? { sex: gender } : {}),
          ...(birthDate ? { dob: birthDate } : {}),
        },
      });
      return NextResponse.json(localPatientToFhirEntry(patient).resource);
    }

    // ── Medplum / FHIR backend ──
    const { phenomlClient } = await import("@/lib/phenoml/client");
    const providerId = process.env.PHENOML_FHIR_PROVIDER_ID;
    if (!providerId) {
      return NextResponse.json({ error: "FHIR provider not configured" }, { status: 500 });
    }

    if (!body.resourceType || body.resourceType !== "Patient") {
      return NextResponse.json({ error: "Invalid resource: must be a Patient" }, { status: 400 });
    }
    if (!body.id) {
      return NextResponse.json({ error: "Patient ID is required for upsert" }, { status: 400 });
    }

    const result = await phenomlClient.fhir.upsert(providerId, `Patient/${body.id}`, { body });
    return NextResponse.json(result);
  } catch (error) {
    console.error("FHIR Patient upsert error:", error);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const status = (error as any)?.statusCode || 500;
    const message = error instanceof Error ? error.message : "Failed to update patient";
    return NextResponse.json({ error: message }, { status });
  }
}

// DELETE /api/fhir/patient?id=<id>
// Admin-only: deletes the patient and cleans up local Prisma records
export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth();
  if (!isSession(authResult)) return authResult;

  if (authResult.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id?.trim()) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    // ── Local backend ──
    if (isLocalBackend()) {
      await prismaClinical.patient.delete({ where: { id } });
      await prisma.userPatient.deleteMany({ where: { patientLocalId: id } });
      await prisma.patientTag.deleteMany({ where: { patientLocalId: id } });
      return NextResponse.json({ deleted: id });
    }

    // ── Medplum / FHIR backend ──
    const { phenomlClient } = await import("@/lib/phenoml/client");
    const providerId = process.env.PHENOML_FHIR_PROVIDER_ID;
    if (!providerId) {
      return NextResponse.json({ error: "FHIR provider not configured" }, { status: 500 });
    }

    await phenomlClient.fhir.delete(providerId, `Patient/${id}`);
    await prisma.userPatient.deleteMany({ where: { patientFhirId: id } });
    await prisma.patientTag.deleteMany({ where: { patientFhirId: id } });
    return NextResponse.json({ deleted: id });
  } catch (error) {
    console.error("FHIR Patient delete error:", error);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawStatus = (error as any)?.statusCode;
    const status = [400, 404, 409, 422, 500].includes(rawStatus) ? rawStatus : 500;
    const message = error instanceof Error ? error.message : "Failed to delete patient";
    return NextResponse.json({ error: message }, { status });
  }
}
