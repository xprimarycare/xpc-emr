import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

// GET /api/patient-tags?patientFhirIds=id1,id2,...
// Returns tags grouped by patient and category
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (!isSession(authResult)) return authResult;

  if (authResult.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ids = request.nextUrl.searchParams.get("patientFhirIds");
  if (!ids) {
    return NextResponse.json({ error: "patientFhirIds required" }, { status: 400 });
  }

  const patientFhirIds = ids.split(",").filter(Boolean);

  const tags = await prisma.patientTag.findMany({
    where: { patientFhirId: { in: patientFhirIds } },
    orderBy: { createdAt: "asc" },
  });

  // Group by patientFhirId → { conditions: [], competencies: [], contexts: [] }
  const grouped: Record<string, { conditions: string[]; competencies: string[]; contexts: string[] }> = {};
  for (const tag of tags) {
    if (!grouped[tag.patientFhirId]) {
      grouped[tag.patientFhirId] = { conditions: [], competencies: [], contexts: [] };
    }
    const cat = tag.category as keyof typeof grouped[string];
    if (cat in grouped[tag.patientFhirId]) {
      grouped[tag.patientFhirId][cat].push(tag.value);
    }
  }

  return NextResponse.json(grouped);
}

// PUT /api/patient-tags
// Replaces all tags for a patient in a given category
export async function PUT(request: NextRequest) {
  console.log("[patient-tags] PUT called");
  const authResult = await requireAuth();
  if (!isSession(authResult)) {
    console.log("[patient-tags] PUT auth failed");
    return authResult;
  }

  if (authResult.user.role !== "admin") {
    console.log("[patient-tags] PUT forbidden, role:", authResult.user.role);
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    console.log("[patient-tags] PUT body:", JSON.stringify(body));
    const { patientFhirId, tags } = body;

    if (!patientFhirId?.trim()) {
      return NextResponse.json({ error: "patientFhirId required" }, { status: 400 });
    }
    if (!tags || typeof tags !== "object") {
      return NextResponse.json({ error: "tags object required" }, { status: 400 });
    }

    const pid = patientFhirId.trim();

    // Replace tags for each provided category
    for (const category of ["conditions", "competencies", "contexts"] as const) {
      if (!(category in tags)) continue;

      const values: string[] = tags[category];
      console.log(`[patient-tags] ${category}: delete existing, create ${values.length} new`);

      // Delete existing tags for this category
      await prisma.patientTag.deleteMany({
        where: { patientFhirId: pid, category },
      });

      // Insert new tags
      if (values.length > 0) {
        await prisma.patientTag.createMany({
          data: values.map((value: string) => ({
            patientFhirId: pid,
            category,
            value,
          })),
        });
      }
    }

    console.log("[patient-tags] PUT success for", pid);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Patient tags API error:", error);
    return NextResponse.json({ error: "Failed to save tags" }, { status: 500 });
  }
}
