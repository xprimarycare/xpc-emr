import { phenomlClient } from "@/lib/phenoml/client";
import { NextRequest, NextResponse } from "next/server";

// GET /api/fhir/patient - Search patients
// GET /api/fhir/patient?id=123 - Get specific patient
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const patientId = searchParams.get("id");
    const name = searchParams.get("name");

    // Get the FHIR provider ID (you may need to configure this)
    const providerId = process.env.PHENOML_FHIR_PROVIDER_ID;

    if (!providerId) {
      return NextResponse.json(
        { error: "FHIR provider not configured" },
        { status: 500 }
      );
    }

    const result = await phenomlClient.fhir.search(
      providerId,
      "Patient",
      {}
    );

    // Filter server-side since PhenoML SDK query_parameters
    // doesn't reliably forward FHIR search params
    const bundle = result as any;
    if (bundle?.entry) {
      if (patientId) {
        bundle.entry = bundle.entry.filter(
          (entry: any) => entry.resource?.id === patientId
        );
      }
      if (name) {
        const query = name.toLowerCase();
        bundle.entry = bundle.entry.filter((entry: any) => {
          const resource = entry.resource;
          if (!resource?.name) return false;
          return resource.name.some((n: any) => {
            const parts = [
              n.text,
              n.family,
              ...(n.given || []),
            ].filter(Boolean);
            return parts.some((p: string) => p.toLowerCase().includes(query));
          });
        });
      }
      bundle.total = bundle.entry.length;
    }

    return NextResponse.json(bundle);
  } catch (error) {
    console.error("FHIR Patient search error:", error);
    return NextResponse.json(
      { error: "Failed to fetch patients" },
      { status: 500 }
    );
  }
}

// POST /api/fhir/patient - Create a new patient in Medplum via FHIR create
export async function POST(request: NextRequest) {
  try {
    const providerId = process.env.PHENOML_FHIR_PROVIDER_ID;
    if (!providerId) {
      return NextResponse.json(
        { error: "FHIR provider not configured" },
        { status: 500 }
      );
    }

    const { name, gender, dateOfBirth } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: "Patient name is required" },
        { status: 400 }
      );
    }

    // Build a FHIR Patient resource
    const nameParts = name.trim().split(/\s+/);
    const family = nameParts.length > 1 ? nameParts.pop()! : "";
    const given = nameParts;

    const body = {
      resourceType: "Patient",
      name: [{
        given: given.length > 0 ? given : undefined,
        family: family || undefined,
      }],
      gender: gender || undefined,
      birthDate: dateOfBirth || undefined,
    };

    // Use fhir.create (POST) — server assigns the ID
    const result = await phenomlClient.fhir.create(
      providerId,
      "Patient",
      { body }
    );

    const fhirId = (result as any)?.id;
    if (!fhirId) {
      return NextResponse.json(
        { error: "Patient created but no ID returned" },
        { status: 500 }
      );
    }

    return NextResponse.json({ fhirId });
  } catch (error) {
    console.error("FHIR Patient create error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to create patient";
    return NextResponse.json({ error: message }, { status });
  }
}

// PUT /api/fhir/patient - Upsert (create or update) a patient in Medplum
export async function PUT(request: NextRequest) {
  try {
    const providerId = process.env.PHENOML_FHIR_PROVIDER_ID;
    if (!providerId) {
      return NextResponse.json(
        { error: "FHIR provider not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();

    if (!body.resourceType || body.resourceType !== "Patient") {
      return NextResponse.json(
        { error: "Invalid resource: must be a Patient" },
        { status: 400 }
      );
    }
    if (!body.id) {
      return NextResponse.json(
        { error: "Patient ID is required for upsert" },
        { status: 400 }
      );
    }

    const result = await phenomlClient.fhir.upsert(
      providerId,
      `Patient/${body.id}`,
      { body }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("FHIR Patient upsert error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to update patient";
    return NextResponse.json({ error: message }, { status });
  }
}
