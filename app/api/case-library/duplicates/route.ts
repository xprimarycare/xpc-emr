import { NextResponse } from "next/server";
import { requireAuth, isSession } from "@/lib/auth-helpers";
import { phenomlClient } from "@/lib/phenoml/client";

const providerId = process.env.PHENOML_FHIR_PROVIDER_ID;

export interface DuplicatePatientEntry {
  fhirId: string;
  name: string;
  birthDate: string;
  gender: string;
}

// GET /api/case-library/duplicates
// Admin-only: scans all FHIR patients and returns groups with identical name + birthDate
export async function GET() {
  const authResult = await requireAuth();
  if (!isSession(authResult)) return authResult;

  if (authResult.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!providerId) {
    return NextResponse.json({ error: "FHIR provider not configured" }, { status: 500 });
  }

  try {
    const bundle = (await phenomlClient.fhir.search(
      providerId,
      "Patient",
      {},
      { queryParams: { _count: "500" } }
    )) as any;

    const truncated = typeof bundle?.total === "number" && bundle.total > (bundle?.entry?.length ?? 0);

    const patients: DuplicatePatientEntry[] = (bundle?.entry || []).map((e: any) => {
      const r = e.resource;
      const nameEntry = r?.name?.[0];
      const given = nameEntry?.given?.join(" ") || "";
      const family = nameEntry?.family || "";
      const name = [given, family].filter(Boolean).join(" ") || "Unknown";
      return {
        fhirId: r.id,
        name,
        birthDate: r?.birthDate || "",
        gender: r?.gender || "",
      };
    });

    // Group by exact name + birthDate
    const groups: Record<string, DuplicatePatientEntry[]> = {};
    for (const p of patients) {
      const key = `${p.name}|${p.birthDate}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }

    const duplicates = Object.values(groups).filter((g) => g.length >= 2);

    return NextResponse.json({ duplicates, truncated });
  } catch (error) {
    console.error("Duplicate scan error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to scan for duplicates" },
      { status: 500 }
    );
  }
}
