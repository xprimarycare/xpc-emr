import { phenomlClient } from "@/lib/phenoml/client";
import { NextRequest, NextResponse } from "next/server";

// GET /api/fhir/appointment?date=ge{start}&date=le{end} or ?patient={fhirId}
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dateParams = searchParams.getAll("date");
    const patientFhirId = searchParams.get("patient");

    const providerId = process.env.PHENOML_FHIR_PROVIDER_ID;
    if (!providerId) {
      return NextResponse.json(
        { error: "FHIR provider not configured" },
        { status: 500 }
      );
    }

    const queryParams: Record<string, string> = { _count: "100" };

    if (dateParams.length > 0) {
      // FHIR date search: date=ge2026-02-01&date=le2026-02-28
      dateParams.forEach((d, i) => {
        queryParams[i === 0 ? "date" : `date:${i}`] = d;
      });
    }

    if (patientFhirId) {
      queryParams["actor"] = `Patient/${patientFhirId}`;
    }

    const result = await phenomlClient.fhir.search(
      providerId,
      "Appointment",
      {},
      { queryParams }
    );

    const bundle = result as any;
    return NextResponse.json(bundle);
  } catch (error) {
    console.error("FHIR Appointment search error:", error);
    return NextResponse.json(
      { error: "Failed to fetch appointments" },
      { status: 500 }
    );
  }
}

// POST /api/fhir/appointment - Create a new Appointment
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

    if (!body.resourceType || body.resourceType !== "Appointment") {
      return NextResponse.json(
        { error: "Invalid resource: must be an Appointment" },
        { status: 400 }
      );
    }

    const result = await phenomlClient.fhir.create(
      providerId,
      "Appointment",
      { body }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("FHIR Appointment create error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to create appointment";
    return NextResponse.json({ error: message }, { status });
  }
}

// PUT /api/fhir/appointment - Update an existing Appointment
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

    if (!body.resourceType || body.resourceType !== "Appointment") {
      return NextResponse.json(
        { error: "Invalid resource: must be an Appointment" },
        { status: 400 }
      );
    }
    if (!body.id) {
      return NextResponse.json(
        { error: "Appointment ID is required for upsert" },
        { status: 400 }
      );
    }

    const result = await phenomlClient.fhir.upsert(
      providerId,
      `Appointment/${body.id}`,
      { body }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("FHIR Appointment upsert error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to update appointment";
    return NextResponse.json({ error: message }, { status });
  }
}

// DELETE /api/fhir/appointment?id={appointmentFhirId}
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const appointmentId = searchParams.get("id");

    const providerId = process.env.PHENOML_FHIR_PROVIDER_ID;
    if (!providerId) {
      return NextResponse.json(
        { error: "FHIR provider not configured" },
        { status: 500 }
      );
    }

    if (!appointmentId) {
      return NextResponse.json(
        { error: "Appointment ID is required" },
        { status: 400 }
      );
    }

    await phenomlClient.fhir.delete(
      providerId,
      `Appointment/${appointmentId}`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("FHIR Appointment delete error:", error);
    const status = (error as any)?.statusCode || 500;
    const message =
      error instanceof Error ? error.message : "Failed to delete appointment";
    return NextResponse.json({ error: message }, { status });
  }
}
