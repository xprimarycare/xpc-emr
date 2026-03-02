import { phenomlClient } from "@/lib/phenoml/client";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isSession } from "@/lib/auth-helpers";

// GET /api/fhir/goal?patient={fhirId} - Search patient's goals
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
      "Goal",
      {},
      { queryParams: { subject: `Patient/${patientFhirId}`, _count: "100" } }
    );

    const bundle = result as any;
    return NextResponse.json(bundle);
  } catch (error) {
    console.error("FHIR Goal search error:", error);
    return NextResponse.json(
      { error: "Failed to fetch goals" },
      { status: 500 }
    );
  }
}

// PUT /api/fhir/goal - Upsert a Goal in Medplum
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

    if (!body.resourceType || body.resourceType !== "Goal") {
      return NextResponse.json(
        { error: "Invalid resource: must be a Goal" },
        { status: 400 }
      );
    }
    if (!body.id) {
      return NextResponse.json(
        { error: "Goal ID is required for upsert" },
        { status: 400 }
      );
    }

    const result = await phenomlClient.fhir.upsert(
      providerId,
      `Goal/${body.id}`,
      { body }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("FHIR Goal upsert error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to update goal";
    return NextResponse.json({ error: message }, { status });
  }
}

// DELETE /api/fhir/goal?id={goalId} - Delete a Goal from Medplum
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

    const goalId = request.nextUrl.searchParams.get("id");
    if (!goalId) {
      return NextResponse.json(
        { error: "id parameter is required" },
        { status: 400 }
      );
    }

    await phenomlClient.fhir.delete(
      providerId,
      `Goal/${goalId}`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("FHIR Goal delete error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to delete goal";
    return NextResponse.json({ error: message }, { status });
  }
}

// POST /api/fhir/goal - Create a new Goal in Medplum
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

    if (!body.resourceType || body.resourceType !== "Goal") {
      return NextResponse.json(
        { error: "Invalid resource: must be a Goal" },
        { status: 400 }
      );
    }

    const result = await phenomlClient.fhir.create(
      providerId,
      "Goal",
      { body }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("FHIR Goal create error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to create goal";
    return NextResponse.json({ error: message }, { status });
  }
}
