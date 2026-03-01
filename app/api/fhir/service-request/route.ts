import { phenomlClient } from "@/lib/phenoml/client";
import { NextRequest, NextResponse } from "next/server";

// GET /api/fhir/service-request?patient={fhirId} - Search patient's lab orders
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

    // Use requestOptions.queryParams for server-side patient filtering.
    const result = await phenomlClient.fhir.search(
      providerId,
      "ServiceRequest",
      {},
      { queryParams: { subject: `Patient/${patientFhirId}`, _count: "100" } }
    );

    const bundle = result as any;

    return NextResponse.json(bundle);
  } catch (error) {
    console.error("FHIR ServiceRequest search error:", error);
    return NextResponse.json(
      { error: "Failed to fetch lab orders" },
      { status: 500 }
    );
  }
}

// POST /api/fhir/service-request - Create a new ServiceRequest in Medplum
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

    if (!body.resourceType || body.resourceType !== "ServiceRequest") {
      return NextResponse.json(
        { error: "Invalid resource: must be a ServiceRequest" },
        { status: 400 }
      );
    }

    const result = await phenomlClient.fhir.create(
      providerId,
      "ServiceRequest",
      { body }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("FHIR ServiceRequest create error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to create lab order";
    return NextResponse.json({ error: message }, { status });
  }
}

// PUT /api/fhir/service-request - Update an existing ServiceRequest in Medplum
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

    if (!body.resourceType || body.resourceType !== "ServiceRequest") {
      return NextResponse.json(
        { error: "Invalid resource: must be a ServiceRequest" },
        { status: 400 }
      );
    }
    if (!body.id) {
      return NextResponse.json(
        { error: "ServiceRequest ID is required for upsert" },
        { status: 400 }
      );
    }

    const result = await phenomlClient.fhir.upsert(
      providerId,
      `ServiceRequest/${body.id}`,
      { body }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("FHIR ServiceRequest upsert error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to update lab order";
    return NextResponse.json({ error: message }, { status });
  }
}
