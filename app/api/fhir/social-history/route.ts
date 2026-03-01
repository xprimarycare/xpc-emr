import { phenomlClient } from "@/lib/phenoml/client";
import { NextRequest, NextResponse } from "next/server";

// GET /api/fhir/social-history?patient={fhirId} - Search patient's social history observations
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

    const result = await phenomlClient.fhir.search(
      providerId,
      "Observation",
      {},
      {
        queryParams: {
          subject: `Patient/${patientFhirId}`,
          category: "social-history",
          _count: "100",
        },
      }
    );

    const bundle = result as any;
    return NextResponse.json(bundle);
  } catch (error) {
    console.error("FHIR Social History search error:", error);
    return NextResponse.json(
      { error: "Failed to fetch social history" },
      { status: 500 }
    );
  }
}

// PUT /api/fhir/social-history - Upsert a social history Observation in Medplum
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

    if (!body.resourceType || body.resourceType !== "Observation") {
      return NextResponse.json(
        { error: "Invalid resource: must be an Observation" },
        { status: 400 }
      );
    }
    if (!body.id) {
      return NextResponse.json(
        { error: "Observation ID is required for upsert" },
        { status: 400 }
      );
    }

    const result = await phenomlClient.fhir.upsert(
      providerId,
      `Observation/${body.id}`,
      { body }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("FHIR Social History upsert error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to update social history observation";
    return NextResponse.json({ error: message }, { status });
  }
}

// DELETE /api/fhir/social-history?id={observationId} - Delete a social history Observation from Medplum
export async function DELETE(request: NextRequest) {
  try {
    const providerId = process.env.PHENOML_FHIR_PROVIDER_ID;
    if (!providerId) {
      return NextResponse.json(
        { error: "FHIR provider not configured" },
        { status: 500 }
      );
    }

    const observationId = request.nextUrl.searchParams.get("id");
    if (!observationId) {
      return NextResponse.json(
        { error: "id parameter is required" },
        { status: 400 }
      );
    }

    await phenomlClient.fhir.delete(
      providerId,
      `Observation/${observationId}`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("FHIR Social History delete error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to delete social history observation";
    return NextResponse.json({ error: message }, { status });
  }
}

// POST /api/fhir/social-history - Create a new social history Observation in Medplum
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

    if (!body.resourceType || body.resourceType !== "Observation") {
      return NextResponse.json(
        { error: "Invalid resource: must be an Observation" },
        { status: 400 }
      );
    }

    const result = await phenomlClient.fhir.create(
      providerId,
      "Observation",
      { body }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("FHIR Social History create error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to create social history observation";
    return NextResponse.json({ error: message }, { status });
  }
}
