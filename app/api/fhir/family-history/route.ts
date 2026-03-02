import { phenomlClient } from "@/lib/phenoml/client";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isSession } from "@/lib/auth-helpers";

// GET /api/fhir/family-history?patient={fhirId} - Search patient's family history
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

    const result = await phenomlClient.fhir.search(
      providerId,
      "FamilyMemberHistory",
      {},
      { queryParams: { patient: `Patient/${patientFhirId}`, _count: "100" } }
    );

    const bundle = result as any;
    return NextResponse.json(bundle);
  } catch (error) {
    console.error("FHIR FamilyMemberHistory search error:", error);
    return NextResponse.json(
      { error: "Failed to fetch family history" },
      { status: 500 }
    );
  }
}

// PUT /api/fhir/family-history - Upsert a FamilyMemberHistory in Medplum
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

    if (!body.resourceType || body.resourceType !== "FamilyMemberHistory") {
      return NextResponse.json(
        { error: "Invalid resource: must be a FamilyMemberHistory" },
        { status: 400 }
      );
    }
    if (!body.id) {
      return NextResponse.json(
        { error: "FamilyMemberHistory ID is required for upsert" },
        { status: 400 }
      );
    }

    const result = await phenomlClient.fhir.upsert(
      providerId,
      `FamilyMemberHistory/${body.id}`,
      { body }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("FHIR FamilyMemberHistory upsert error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to update family history";
    return NextResponse.json({ error: message }, { status });
  }
}

// DELETE /api/fhir/family-history?id={id} - Delete a FamilyMemberHistory from Medplum
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

    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "id parameter is required" },
        { status: 400 }
      );
    }

    await phenomlClient.fhir.delete(
      providerId,
      `FamilyMemberHistory/${id}`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("FHIR FamilyMemberHistory delete error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to delete family history";
    return NextResponse.json({ error: message }, { status });
  }
}

// POST /api/fhir/family-history - Create a new FamilyMemberHistory in Medplum
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

    if (!body.resourceType || body.resourceType !== "FamilyMemberHistory") {
      return NextResponse.json(
        { error: "Invalid resource: must be a FamilyMemberHistory" },
        { status: 400 }
      );
    }

    const result = await phenomlClient.fhir.create(
      providerId,
      "FamilyMemberHistory",
      { body }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("FHIR FamilyMemberHistory create error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to create family history";
    return NextResponse.json({ error: message }, { status });
  }
}
