import { phenomlClient } from "@/lib/phenoml/client";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isSession } from "@/lib/auth-helpers";

// GET /api/fhir/communication?patient={fhirId} - Search patient's messages
// Optional: &thread={threadId} to get messages in a specific thread
export async function GET(request: NextRequest) {
  const authResult = await requireAuth()
  if (!isSession(authResult)) return authResult

  try {
    const searchParams = request.nextUrl.searchParams;
    const patientFhirId = searchParams.get("patient");
    const threadId = searchParams.get("thread");

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

    let queryParams: Record<string, string>;

    if (threadId) {
      // Get messages in a specific thread
      queryParams = {
        "part-of": `Communication/${threadId}`,
        _sort: "sent",
        _count: "100",
      };
    } else {
      // Get all thread headers + their messages for this patient
      queryParams = {
        subject: `Patient/${patientFhirId}`,
        "part-of:missing": "true",
        _revinclude: "Communication:part-of",
        _sort: "-sent",
        _count: "100",
      };
    }

    const result = await phenomlClient.fhir.search(
      providerId,
      "Communication",
      {},
      { queryParams }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("FHIR Communication search error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to fetch messages";
    return NextResponse.json({ error: message }, { status });
  }
}

// POST /api/fhir/communication - Create a new Communication
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

    if (!body.resourceType || body.resourceType !== "Communication") {
      return NextResponse.json(
        { error: "Invalid resource: must be a Communication" },
        { status: 400 }
      );
    }

    const result = await phenomlClient.fhir.create(
      providerId,
      "Communication",
      { body }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("FHIR Communication create error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to create message";
    return NextResponse.json({ error: message }, { status });
  }
}
