import { phenomlClient } from "@/lib/phenoml/client";
import { NextRequest, NextResponse } from "next/server";

// GET /api/fhir/condition?patient={fhirId} - Search patient's conditions
export async function GET(request: NextRequest) {
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

    // Use requestOptions.queryParams to pass FHIR search params directly to Medplum.
    // PhenoML's SDK query_parameters field doesn't work (serialized as literal param name).
    const result = await phenomlClient.fhir.search(
      providerId,
      "Condition",
      {},
      { queryParams: { subject: `Patient/${patientFhirId}`, _count: "100" } }
    );

    const bundle = result as any;
    return NextResponse.json(bundle);
  } catch (error) {
    console.error("FHIR Condition search error:", error);
    return NextResponse.json(
      { error: "Failed to fetch conditions" },
      { status: 500 }
    );
  }
}

// PUT /api/fhir/condition - Upsert a Condition in Medplum
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

    if (!body.resourceType || body.resourceType !== "Condition") {
      return NextResponse.json(
        { error: "Invalid resource: must be a Condition" },
        { status: 400 }
      );
    }
    if (!body.id) {
      return NextResponse.json(
        { error: "Condition ID is required for upsert" },
        { status: 400 }
      );
    }

    const result = await phenomlClient.fhir.upsert(
      providerId,
      `Condition/${body.id}`,
      { body }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("FHIR Condition upsert error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to update condition";
    return NextResponse.json({ error: message }, { status });
  }
}

// DELETE /api/fhir/condition?id={conditionFhirId} - Delete a Condition from Medplum
export async function DELETE(request: NextRequest) {
  try {
    const providerId = process.env.PHENOML_FHIR_PROVIDER_ID;
    if (!providerId) {
      return NextResponse.json(
        { error: "FHIR provider not configured" },
        { status: 500 }
      );
    }

    const conditionId = request.nextUrl.searchParams.get("id");
    if (!conditionId) {
      return NextResponse.json(
        { error: "id parameter is required" },
        { status: 400 }
      );
    }

    await phenomlClient.fhir.delete(
      providerId,
      `Condition/${conditionId}`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("FHIR Condition delete error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to delete condition";
    return NextResponse.json({ error: message }, { status });
  }
}

// POST /api/fhir/condition - Create a new Condition in Medplum
export async function POST(request: NextRequest) {
  try {
    const providerId = process.env.PHENOML_FHIR_PROVIDER_ID;
    if (!providerId) {
      return NextResponse.json(
        { error: "FHIR provider not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();

    if (!body.resourceType || body.resourceType !== "Condition") {
      return NextResponse.json(
        { error: "Invalid resource: must be a Condition" },
        { status: 400 }
      );
    }

    const result = await phenomlClient.fhir.create(
      providerId,
      "Condition",
      { body }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("FHIR Condition create error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to create condition";
    return NextResponse.json({ error: message }, { status });
  }
}
