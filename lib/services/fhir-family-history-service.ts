import { FhirFamilyMemberHistoryBundle } from "@/lib/types/fhir";
import { AppFamilyMemberHistory, AppFamilyCondition } from "@/lib/types/family-history";
import {
  mapFhirBundleToFamilyHistories,
  mapAppFamilyHistoryToFhirFamilyHistory,
} from "@/lib/phenoml/fhir-mapper";
import { isLocalBackendClient } from "@/lib/emr-backend";

// Common family history condition abbreviations
const FAMILY_HISTORY_ABBREVIATIONS: Record<string, string> = {
  htn: "hypertension",
  dm: "diabetes mellitus",
  dm2: "type 2 diabetes mellitus",
  dm1: "type 1 diabetes mellitus",
  cad: "coronary artery disease",
  mi: "myocardial infarction",
  ca: "cancer",
  chf: "congestive heart failure",
  afib: "atrial fibrillation",
  ckd: "chronic kidney disease",
  copd: "chronic obstructive pulmonary disease",
  cva: "cerebrovascular accident",
  dvt: "deep vein thrombosis",
  pe: "pulmonary embolism",
  ra: "rheumatoid arthritis",
  sle: "systemic lupus erythematosus",
  ibd: "inflammatory bowel disease",
  uc: "ulcerative colitis",
  hld: "hyperlipidemia",
  hx: "history",
  sz: "seizure",
  als: "amyotrophic lateral sclerosis",
  ms: "multiple sclerosis",
  pcos: "polycystic ovary syndrome",
};

// Relationship keyword → V3 RoleCode mapping
export const RELATIONSHIP_KEYWORDS: Record<string, { code: string; display: string }> = {
  father: { code: "FTH", display: "Father" },
  dad: { code: "FTH", display: "Father" },
  mother: { code: "MTH", display: "Mother" },
  mom: { code: "MTH", display: "Mother" },
  brother: { code: "BRO", display: "Brother" },
  sister: { code: "SIS", display: "Sister" },
  grandfather: { code: "GRFTH", display: "Grandfather" },
  grandpa: { code: "GRFTH", display: "Grandfather" },
  grandmother: { code: "GRMTH", display: "Grandmother" },
  grandma: { code: "GRMTH", display: "Grandmother" },
  uncle: { code: "UNCLE", display: "Uncle" },
  aunt: { code: "AUNT", display: "Aunt" },
  cousin: { code: "COUSIN", display: "Cousin" },
  niece: { code: "NIECE", display: "Niece" },
  nephew: { code: "NEPHEW", display: "Nephew" },
  son: { code: "CHILD", display: "Son" },
  daughter: { code: "CHILD", display: "Daughter" },
  child: { code: "CHILD", display: "Child" },
  grandchild: { code: "GRNDCHILD", display: "Grandchild" },
  grandson: { code: "GRNDCHILD", display: "Grandson" },
  granddaughter: { code: "GRNDCHILD", display: "Granddaughter" },
};

function expandFamilyAbbreviations(text: string): string {
  return text.replace(/\b[a-zA-Z0-9]+\b/g, (word) => {
    const replacement = FAMILY_HISTORY_ABBREVIATIONS[word.toLowerCase()];
    return replacement || word;
  });
}

export interface ResolvedFamilyCode {
  code: string;
  description: string;
}

export interface ResolvedFamilyConditionTerm {
  term: string;
  onsetAge?: string;
}

export interface ResolvedFamilyEntry {
  relationshipTerm: string;
  relationship?: { code: string; display: string };
  conditionTerms: ResolvedFamilyConditionTerm[];
  resolvedConditions: Array<{
    term: string;
    onsetAge?: string;
    code?: ResolvedFamilyCode;
  }>;
  deceased?: boolean;
  deceasedAge?: string;
}

export interface BatchResolveFamilyResult {
  entries: ResolvedFamilyEntry[];
  error?: string;
}

/**
 * Parse free text like:
 *   "father - heart attack age 65, deceased"
 *   "mother - breast cancer, dm2"
 *   "brother - htn age 45"
 *   "sister ADHD"              (no dash — first word is relationship, rest are conditions)
 *   "father heart attack, dm"  (no dash — first word is relationship, rest are conditions)
 *
 * Each line is a family member. If a dash is present, text before it is the relationship
 * and text after is conditions. If no dash, the first word is checked as a relationship
 * keyword and the remainder becomes conditions.
 * "age XX" is extracted as onset age. "deceased" is extracted as a flag.
 */
export function parseFamilyHistoryText(text: string): ResolvedFamilyEntry[] {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return lines.map((line) => {
    const dashIndex = line.indexOf("-");
    let relationshipPart: string;
    let conditionsPart: string;

    if (dashIndex >= 0) {
      relationshipPart = line.slice(0, dashIndex).trim();
      conditionsPart = line.slice(dashIndex + 1).trim();
    } else {
      // No dash — try to match the first word as a relationship keyword
      const words = line.split(/\s+/);
      const firstWord = words[0]?.toLowerCase();
      if (firstWord && RELATIONSHIP_KEYWORDS[firstWord]) {
        relationshipPart = words[0];
        conditionsPart = words.slice(1).join(" ");
      } else {
        // Try first two words (e.g. "maternal grandmother")
        const twoWords = words.slice(0, 2).join(" ").toLowerCase();
        if (words.length >= 2 && RELATIONSHIP_KEYWORDS[twoWords]) {
          relationshipPart = words.slice(0, 2).join(" ");
          conditionsPart = words.slice(2).join(" ");
        } else {
          relationshipPart = line;
          conditionsPart = "";
        }
      }
    }

    // Match relationship keyword
    const relKey = relationshipPart.toLowerCase().trim();
    const relationship = RELATIONSHIP_KEYWORDS[relKey];

    // Parse conditions, extracting "deceased" and "age XX"
    let deceased = false;
    let deceasedAge: string | undefined;
    const conditionTerms: ResolvedFamilyConditionTerm[] = [];

    if (conditionsPart) {
      const segments = conditionsPart
        .split(/[,]+/)
        .flatMap((s) => s.split(/\band\b/i))
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const seg of segments) {
        // "deceased" alone or "deceased age XX"
        const deceasedMatch = seg.match(/^\s*deceased(?:\s+(?:age\s+)?(\d+))?\s*$/i);
        if (deceasedMatch) {
          deceased = true;
          if (deceasedMatch[1]) deceasedAge = deceasedMatch[1];
          continue;
        }
        // Extract "age XX" or just a bare number from condition segment
        const ageMatch = seg.match(/\bage\s+(\d+)\b/i);
        const bareNumberMatch = !ageMatch ? seg.match(/\b(\d+)\b/) : null;
        const extractedAge = ageMatch?.[1] || bareNumberMatch?.[1];

        if (extractedAge) {
          const withoutAge = seg
            .replace(ageMatch ? /\bage\s+\d+\b/i : /\b\d+\b/, "")
            .trim();
          if (withoutAge) {
            conditionTerms.push({ term: expandFamilyAbbreviations(withoutAge), onsetAge: extractedAge });
          }
        } else {
          conditionTerms.push({ term: expandFamilyAbbreviations(seg) });
        }
      }
    }

    return {
      relationshipTerm: relationshipPart,
      relationship,
      conditionTerms,
      resolvedConditions: [],
      deceased,
      deceasedAge,
    };
  });
}

async function searchConditionCodes(
  text: string
): Promise<{ codes: ResolvedFamilyCode[]; error?: string }> {
  if (isLocalBackendClient()) {
    try {
      const params = new URLSearchParams({ text, category: "condition", limit: "5" });
      const response = await fetch(`/api/clinical/catalog?${params}`);
      const data = await response.json();
      if (!response.ok) {
        return { codes: [], error: data.error || "Failed to search condition codes" };
      }
      const codes: ResolvedFamilyCode[] = (data.codes || []).map(
        (c: any) => ({ code: c.code, description: c.display })
      );
      return { codes };
    } catch (error) {
      return { codes: [], error: error instanceof Error ? error.message : "Network error" };
    }
  }

  try {
    const params = new URLSearchParams({
      codesystem: "SNOMEDCT",
      text,
      limit: "5",
    });
    const response = await fetch(`/api/fhir/construe/semantic?${params}`);

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return { codes: [], error: `Server error (${response.status})` };
    }

    const data = await response.json();

    if (!response.ok) {
      return { codes: [], error: data.error || "Failed to search condition codes" };
    }

    const codes: ResolvedFamilyCode[] = (data.results || []).map(
      (r: any) => ({
        code: r.code,
        description: r.description || r.code,
      })
    );

    return { codes };
  } catch (error) {
    return {
      codes: [],
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export async function batchResolveFamilyHistory(
  text: string
): Promise<BatchResolveFamilyResult> {
  const entries = parseFamilyHistoryText(text);
  if (entries.length === 0) {
    return { entries: [], error: "No family members found in text" };
  }

  try {
    // Resolve SNOMED codes for each condition term across all entries
    for (const entry of entries) {
      const resolved = await Promise.all(
        entry.conditionTerms.map(async (ct) => {
          const result = await searchConditionCodes(ct.term);
          return { term: ct.term, onsetAge: ct.onsetAge, code: result.codes[0] };
        })
      );
      entry.resolvedConditions = resolved;
    }
    return { entries };
  } catch (error) {
    return {
      entries: entries.map((e) => ({
        ...e,
        resolvedConditions: e.conditionTerms.map((ct) => ({ term: ct.term, onsetAge: ct.onsetAge })),
      })),
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

// --- FHIR CRUD Operations ---

export interface FamilyHistorySearchResult {
  members: AppFamilyMemberHistory[];
  total: number;
  error?: string;
}

export async function searchFhirFamilyHistories(
  patientFhirId: string
): Promise<FamilyHistorySearchResult> {
  if (isLocalBackendClient()) {
    try {
      const response = await fetch(
        `/api/clinical/family-history?patient=${encodeURIComponent(patientFhirId)}`
      );
      const data = await response.json();
      if (!response.ok) {
        return { members: [], total: 0, error: data.error || "Failed to fetch family history" };
      }
      const members: AppFamilyMemberHistory[] = (data.items || []).map(
        (item: any) => ({
          ...item,
          fhirId: item.id,
          conditions: (item.conditions || []).map((c: any) => ({ ...c, fhirId: c.id })),
        })
      );
      return { members, total: data.total ?? members.length };
    } catch (error) {
      return { members: [], total: 0, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  try {
    const response = await fetch(
      `/api/fhir/family-history?patient=${encodeURIComponent(patientFhirId)}`
    );

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return { members: [], total: 0, error: `Server error (${response.status})` };
    }

    const data = await response.json();

    if (!response.ok) {
      return { members: [], total: 0, error: data.error || "Failed to fetch family history" };
    }

    const bundle = data as FhirFamilyMemberHistoryBundle;
    const members = mapFhirBundleToFamilyHistories(bundle);

    return { members, total: bundle.total ?? members.length };
  } catch (error) {
    return {
      members: [],
      total: 0,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface FamilyHistoryUpsertResult {
  success: boolean;
  error?: string;
}

export async function upsertFhirFamilyHistory(
  member: AppFamilyMemberHistory,
  patientFhirId: string
): Promise<FamilyHistoryUpsertResult> {
  if (isLocalBackendClient()) {
    try {
      const response = await fetch("/api/clinical/family-history", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...member, id: member.fhirId, patientId: patientFhirId }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || "Failed to save family history" };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  if (!member.fhirId) {
    return { success: false, error: "Family member has no FHIR ID - cannot update without an ID" };
  }

  try {
    const fhirResource = mapAppFamilyHistoryToFhirFamilyHistory(member, patientFhirId);

    const response = await fetch("/api/fhir/family-history", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fhirResource),
    });

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return { success: false, error: `Server error (${response.status})` };
    }

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || "Failed to save family history" };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface FamilyHistoryDeleteResult {
  success: boolean;
  error?: string;
}

export async function deleteFhirFamilyHistory(
  fhirId: string
): Promise<FamilyHistoryDeleteResult> {
  if (isLocalBackendClient()) {
    try {
      const response = await fetch(
        `/api/clinical/family-history?id=${encodeURIComponent(fhirId)}`,
        { method: "DELETE" }
      );
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || "Failed to delete family history" };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  try {
    const response = await fetch(
      `/api/fhir/family-history?id=${encodeURIComponent(fhirId)}`,
      { method: "DELETE" }
    );

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return { success: false, error: `Server error (${response.status})` };
    }

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || "Failed to delete family history" };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface FamilyHistoryCreateResult {
  success: boolean;
  fhirId?: string;
  error?: string;
}

export async function createFhirFamilyHistory(
  member: AppFamilyMemberHistory,
  patientFhirId: string
): Promise<FamilyHistoryCreateResult> {
  if (isLocalBackendClient()) {
    try {
      const response = await fetch("/api/clinical/family-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...member, patientId: patientFhirId }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || "Failed to create family history" };
      }
      return { success: true, fhirId: data.id };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  try {
    const fhirResource = mapAppFamilyHistoryToFhirFamilyHistory(member, patientFhirId);
    delete (fhirResource as any).id;

    const response = await fetch("/api/fhir/family-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fhirResource),
    });

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return { success: false, error: `Server error (${response.status})` };
    }

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || "Failed to create family history" };
    }

    return { success: true, fhirId: data.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
