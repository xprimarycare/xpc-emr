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

const TAG_VALUE_MAX = 200;

// PUT /api/patient-tags
// Replaces all tags for a patient in a given category
export async function PUT(request: NextRequest) {
  const authResult = await requireAuth();
  if (!isSession(authResult)) return authResult;

  if (authResult.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { patientFhirId, tags } = body;

    if (!patientFhirId?.trim()) {
      return NextResponse.json({ error: "patientFhirId required" }, { status: 400 });
    }
    if (!tags || typeof tags !== "object") {
      return NextResponse.json({ error: "tags object required" }, { status: 400 });
    }

    const pid = patientFhirId.trim();

    // Replace tags for each provided category inside a single transaction
    await prisma.$transaction(async (tx) => {
      for (const category of ["conditions", "competencies", "contexts"] as const) {
        if (!(category in tags)) continue;

        const values: string[] = tags[category];

        // Validate each value
        for (const value of values) {
          if (typeof value !== "string" || value.length > TAG_VALUE_MAX) {
            throw new Error(`Tag value exceeds ${TAG_VALUE_MAX} characters`);
          }
        }

        await tx.patientTag.deleteMany({ where: { patientFhirId: pid, category } });

        if (values.length > 0) {
          await tx.patientTag.createMany({
            data: values.map((value) => ({ patientFhirId: pid, category, value })),
          });
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Patient tags API error:", error);
    return NextResponse.json({ error: "Failed to save tags" }, { status: 500 });
  }
}
