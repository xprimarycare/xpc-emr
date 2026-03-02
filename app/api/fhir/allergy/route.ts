import { phenomlClient } from "@/lib/phenoml/client";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isSession } from "@/lib/auth-helpers";

// GET /api/fhir/allergy?patient={fhirId} - Search patient's allergies
export async function GET(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const searchParams = request.nextUrl.searchParams;
    const patientFhirId = searchParams.get("patient");

    const providerId = process.env.PHENOML_FHIR_PROVIDER_ID;
    if (!providerId) {
      return NextResponse.json(
        { error: "FHIR provider not configured" },
        { status: 500 }
      );
    }

    if (!patientFhirId) {
      return NextResponse.json(
        { error: "patient parameter is required" },
        { status: 400 }
      );
    }

    // Use requestOptions.queryParams for server-side patient filtering.
    const result = await phenomlClient.fhir.search(
      providerId,
      "AllergyIntolerance",
      {},
      { queryParams: { patient: `Patient/${patientFhirId}`, _count: "100" } }
    );

    const bundle = result as any;

    return NextResponse.json(bundle);
  } catch (error) {
    console.error("FHIR AllergyIntolerance search error:", error);
    return NextResponse.json(
      { error: "Failed to fetch allergies" },
      { status: 500 }
    );
  }
}

// PUT /api/fhir/allergy - Upsert an AllergyIntolerance in Medplum
export async function PUT(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const providerId = process.env.PHENOML_FHIR_PROVIDER_ID;
    if (!providerId) {
      return NextResponse.json(
        { error: "FHIR provider not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();

    if (!body.resourceType || body.resourceType !== "AllergyIntolerance") {
      return NextResponse.json(
        { error: "Invalid resource: must be an AllergyIntolerance" },
        { status: 400 }
      );
    }
    if (!body.id) {
      return NextResponse.json(
        { error: "AllergyIntolerance ID is required for upsert" },
        { status: 400 }
      );
    }

    const result = await phenomlClient.fhir.upsert(
      providerId,
      `AllergyIntolerance/${body.id}`,
      { body }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("FHIR AllergyIntolerance upsert error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to update allergy";
    return NextResponse.json({ error: message }, { status });
  }
}

// DELETE /api/fhir/allergy?id={allergyFhirId} - Delete an AllergyIntolerance from Medplum
export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const providerId = process.env.PHENOML_FHIR_PROVIDER_ID;
    if (!providerId) {
      return NextResponse.json(
        { error: "FHIR provider not configured" },
        { status: 500 }
      );
    }

    const allergyId = request.nextUrl.searchParams.get("id");
    if (!allergyId) {
      return NextResponse.json(
        { error: "id parameter is required" },
        { status: 400 }
      );
    }

    await phenomlClient.fhir.delete(
      providerId,
      `AllergyIntolerance/${allergyId}`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("FHIR AllergyIntolerance delete error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to delete allergy";
    return NextResponse.json({ error: message }, { status });
  }
}

// POST /api/fhir/allergy - Create a new AllergyIntolerance in Medplum
export async function POST(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const providerId = process.env.PHENOML_FHIR_PROVIDER_ID;
    if (!providerId) {
      return NextResponse.json(
        { error: "FHIR provider not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();

    if (!body.resourceType || body.resourceType !== "AllergyIntolerance") {
      return NextResponse.json(
        { error: "Invalid resource: must be an AllergyIntolerance" },
        { status: 400 }
      );
    }

    const result = await phenomlClient.fhir.create(
      providerId,
      "AllergyIntolerance",
      { body }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("FHIR AllergyIntolerance create error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to create allergy";
    return NextResponse.json({ error: message }, { status });
  }
}
