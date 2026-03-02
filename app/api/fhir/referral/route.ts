import { phenomlClient } from "@/lib/phenoml/client";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isSession } from "@/lib/auth-helpers";

// GET /api/fhir/referral?patient={fhirId} - Search patient's referrals
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
      "ServiceRequest",
      {},
      {
        queryParams: {
          subject: `Patient/${patientFhirId}`,
          category: "3457005",
          _count: "100",
        },
      }
    );

    const bundle = result as any;
    return NextResponse.json(bundle);
  } catch (error) {
    console.error("FHIR Referral search error:", error);
    return NextResponse.json(
      { error: "Failed to fetch referrals" },
      { status: 500 }
    );
  }
}

// PUT /api/fhir/referral - Upsert an existing referral ServiceRequest
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
    console.error("FHIR Referral upsert error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to update referral";
    return NextResponse.json({ error: message }, { status });
  }
}

// POST /api/fhir/referral - Create a new referral ServiceRequest
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
    console.error("FHIR Referral create error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to create referral";
    return NextResponse.json({ error: message }, { status });
  }
}
