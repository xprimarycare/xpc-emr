import { phenomlClient } from "@/lib/phenoml/client";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isSession } from "@/lib/auth-helpers";

// GET /api/fhir/task?patient={fhirId} - Search patient's tasks
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
    // Task FHIR search param is "patient" which maps to Task.for
    const result = await phenomlClient.fhir.search(
      providerId,
      "Task",
      {},
      { queryParams: { patient: `Patient/${patientFhirId}`, _count: "100" } }
    );

    const bundle = result as any;

    return NextResponse.json(bundle);
  } catch (error) {
    console.error("FHIR Task search error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

// POST /api/fhir/task - Create a new Task in Medplum
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

    if (!body.resourceType || body.resourceType !== "Task") {
      return NextResponse.json(
        { error: "Invalid resource: must be a Task" },
        { status: 400 }
      );
    }

    const result = await phenomlClient.fhir.create(
      providerId,
      "Task",
      { body }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("FHIR Task create error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to create task";
    return NextResponse.json({ error: message }, { status });
  }
}

// PUT /api/fhir/task - Update an existing Task in Medplum
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

    if (!body.resourceType || body.resourceType !== "Task") {
      return NextResponse.json(
        { error: "Invalid resource: must be a Task" },
        { status: 400 }
      );
    }
    if (!body.id) {
      return NextResponse.json(
        { error: "Task ID is required for upsert" },
        { status: 400 }
      );
    }

    const result = await phenomlClient.fhir.upsert(
      providerId,
      `Task/${body.id}`,
      { body }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("FHIR Task upsert error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to update task";
    return NextResponse.json({ error: message }, { status });
  }
}
