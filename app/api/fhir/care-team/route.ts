import { phenomlClient } from "@/lib/phenoml/client";
import { NextRequest, NextResponse } from "next/server";

// GET /api/fhir/care-team?patient={fhirId} - Search patient's care team members
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
      "CareTeam",
      {},
      { queryParams: { subject: `Patient/${patientFhirId}`, _count: "100" } }
    );

    const bundle = result as any;
    return NextResponse.json(bundle);
  } catch (error) {
    console.error("FHIR CareTeam search error:", error);
    return NextResponse.json(
      { error: "Failed to fetch care team" },
      { status: 500 }
    );
  }
}

// PUT /api/fhir/care-team - Upsert a CareTeam in Medplum
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

    if (!body.resourceType || body.resourceType !== "CareTeam") {
      return NextResponse.json(
        { error: "Invalid resource: must be a CareTeam" },
        { status: 400 }
      );
    }
    if (!body.id) {
      return NextResponse.json(
        { error: "CareTeam ID is required for upsert" },
        { status: 400 }
      );
    }

    const result = await phenomlClient.fhir.upsert(
      providerId,
      `CareTeam/${body.id}`,
      { body }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("FHIR CareTeam upsert error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to update care team member";
    return NextResponse.json({ error: message }, { status });
  }
}

// DELETE /api/fhir/care-team?id={careTeamFhirId} - Delete a CareTeam from Medplum
export async function DELETE(request: NextRequest) {
  try {
    const providerId = process.env.PHENOML_FHIR_PROVIDER_ID;
    if (!providerId) {
      return NextResponse.json(
        { error: "FHIR provider not configured" },
        { status: 500 }
      );
    }

    const careTeamId = request.nextUrl.searchParams.get("id");
    if (!careTeamId) {
      return NextResponse.json(
        { error: "id parameter is required" },
        { status: 400 }
      );
    }

    await phenomlClient.fhir.delete(
      providerId,
      `CareTeam/${careTeamId}`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("FHIR CareTeam delete error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to delete care team member";
    return NextResponse.json({ error: message }, { status });
  }
}

// POST /api/fhir/care-team - Create a new CareTeam in Medplum
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

    if (!body.resourceType || body.resourceType !== "CareTeam") {
      return NextResponse.json(
        { error: "Invalid resource: must be a CareTeam" },
        { status: 400 }
      );
    }

    const result = await phenomlClient.fhir.create(
      providerId,
      "CareTeam",
      { body }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("FHIR CareTeam create error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to create care team member";
    return NextResponse.json({ error: message }, { status });
  }
}
