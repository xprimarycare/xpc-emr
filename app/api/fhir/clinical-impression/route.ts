import { phenomlClient } from "@/lib/phenoml/client";
import { NextRequest, NextResponse } from "next/server";

// GET /api/fhir/clinical-impression?patient={fhirId} - Search patient's clinical impressions
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
      "ClinicalImpression",
      {},
      { queryParams: { subject: `Patient/${patientFhirId}`, _count: "100" } }
    );

    const bundle = result as any;

    return NextResponse.json(bundle);
  } catch (error) {
    console.error("FHIR ClinicalImpression search error:", error);
    return NextResponse.json(
      { error: "Failed to fetch clinical impressions" },
      { status: 500 }
    );
  }
}

// POST /api/fhir/clinical-impression - Create a new ClinicalImpression in Medplum
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

    if (!body.resourceType || body.resourceType !== "ClinicalImpression") {
      return NextResponse.json(
        { error: "Invalid resource: must be a ClinicalImpression" },
        { status: 400 }
      );
    }

    const result = await phenomlClient.fhir.create(
      providerId,
      "ClinicalImpression",
      { body }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("FHIR ClinicalImpression create error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to create clinical impression";
    return NextResponse.json({ error: message }, { status });
  }
}

// PUT /api/fhir/clinical-impression - Update an existing ClinicalImpression in Medplum
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

    if (!body.resourceType || body.resourceType !== "ClinicalImpression") {
      return NextResponse.json(
        { error: "Invalid resource: must be a ClinicalImpression" },
        { status: 400 }
      );
    }
    if (!body.id) {
      return NextResponse.json(
        { error: "ClinicalImpression ID is required for upsert" },
        { status: 400 }
      );
    }

    const result = await phenomlClient.fhir.upsert(
      providerId,
      `ClinicalImpression/${body.id}`,
      { body }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("FHIR ClinicalImpression upsert error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to update clinical impression";
    return NextResponse.json({ error: message }, { status });
  }
}
