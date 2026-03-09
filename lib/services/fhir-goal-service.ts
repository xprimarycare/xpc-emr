import { FhirGoalBundle } from "@/lib/types/fhir";
import { AppGoal } from "@/lib/types/goal";
import {
  mapFhirBundleToGoals,
  mapAppGoalToFhirGoal,
} from "@/lib/phenoml/fhir-mapper";
import { isLocalBackendClient } from "@/lib/emr-backend";

export interface ResolvedGoalCode {
  code: string;
  description: string;
}

// Common goals-of-care abbreviations → expanded terms for SNOMED semantic search
const GOAL_ABBREVIATIONS: Record<string, string> = {
  dnr: "do not resuscitate",
  dni: "do not intubate",
  cmo: "comfort measures only",
  polst: "physician orders for life-sustaining treatment",
  hcp: "health care proxy",
  poa: "power of attorney",
  acp: "advance care planning",
  ad: "advance directive",
  molst: "medical orders for life-sustaining treatment",
  cpr: "cardiopulmonary resuscitation",
  palliative: "palliative care",
  hospice: "hospice care",
};

function expandGoalAbbreviations(text: string): string {
  return text.replace(/\b[a-zA-Z0-9]+\b/g, (word) => {
    const replacement = GOAL_ABBREVIATIONS[word.toLowerCase()];
    return replacement || word;
  });
}

export function parseGoalText(text: string): string[] {
  return text
    .split(/[,\n]+/)
    .flatMap((segment) => segment.split(/\band\b/i))
    .map((term) => expandGoalAbbreviations(term.trim()))
    .filter((term) => term.length > 0);
}

export interface GoalCodeSearchResult {
  codes: ResolvedGoalCode[];
  error?: string;
}

export async function searchGoalCodes(
  text: string
): Promise<GoalCodeSearchResult> {
  if (isLocalBackendClient()) {
    try {
      const params = new URLSearchParams({ text, category: "goal", limit: "5" });
      const response = await fetch(`/api/clinical/catalog?${params}`);
      const data = await response.json();
      if (!response.ok) {
        return { codes: [], error: data.error || "Failed to search goal codes" };
      }
      const codes: ResolvedGoalCode[] = (data.codes || []).map((c: any) => ({
        code: c.code,
        description: c.display,
      }));
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
      return {
        codes: [],
        error: data.error || "Failed to search goal codes",
      };
    }

    const codes: ResolvedGoalCode[] = (data.results || []).map(
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

export interface ResolvedGoalEntry {
  term: string;
  code?: ResolvedGoalCode;
}

export interface BatchResolveResult {
  entries: ResolvedGoalEntry[];
  error?: string;
}

export async function batchResolveGoals(
  text: string
): Promise<BatchResolveResult> {
  const terms = parseGoalText(text);
  if (terms.length === 0) {
    return { entries: [], error: "No goals found in text" };
  }

  try {
    const results = await Promise.all(
      terms.map(async (term): Promise<ResolvedGoalEntry> => {
        const result = await searchGoalCodes(term);
        return {
          term,
          code: result.codes[0],
        };
      })
    );
    return { entries: results };
  } catch (error) {
    return {
      entries: terms.map((term) => ({ term })),
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface GoalSearchResult {
  goals: AppGoal[];
  total: number;
  error?: string;
}

export async function searchFhirGoals(
  patientFhirId: string
): Promise<GoalSearchResult> {
  if (isLocalBackendClient()) {
    try {
      const response = await fetch(
        `/api/clinical/goal?patient=${encodeURIComponent(patientFhirId)}`
      );
      const data = await response.json();
      if (!response.ok) {
        return { goals: [], total: 0, error: data.error || "Failed to fetch goals" };
      }
      const goals = (data.items || []).map((item: any) => ({ ...item, fhirId: item.id }));
      return { goals, total: data.total ?? goals.length };
    } catch (error) {
      return { goals: [], total: 0, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  try {
    const response = await fetch(
      `/api/fhir/goal?patient=${encodeURIComponent(patientFhirId)}`
    );

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return {
        goals: [],
        total: 0,
        error: `Server error (${response.status})`,
      };
    }

    const data = await response.json();

    if (!response.ok) {
      return {
        goals: [],
        total: 0,
        error: data.error || "Failed to fetch goals",
      };
    }

    const bundle = data as FhirGoalBundle;
    const goals = mapFhirBundleToGoals(bundle);

    return {
      goals,
      total: bundle.total ?? goals.length,
    };
  } catch (error) {
    return {
      goals: [],
      total: 0,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface GoalUpsertResult {
  success: boolean;
  error?: string;
}

export async function upsertFhirGoal(
  goal: AppGoal,
  patientFhirId: string
): Promise<GoalUpsertResult> {
  if (isLocalBackendClient()) {
    try {
      const response = await fetch("/api/clinical/goal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...goal, id: goal.fhirId, patientId: patientFhirId }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || "Failed to save goal" };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  if (!goal.fhirId) {
    return {
      success: false,
      error: "Goal has no FHIR ID - cannot update without an ID",
    };
  }

  try {
    const fhirResource = mapAppGoalToFhirGoal(goal, patientFhirId);

    const response = await fetch("/api/fhir/goal", {
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
      return {
        success: false,
        error: data.error || "Failed to save goal",
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface GoalDeleteResult {
  success: boolean;
  error?: string;
}

export async function deleteFhirGoal(
  goalFhirId: string
): Promise<GoalDeleteResult> {
  if (isLocalBackendClient()) {
    try {
      const response = await fetch(
        `/api/clinical/goal?id=${encodeURIComponent(goalFhirId)}`,
        { method: "DELETE" }
      );
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || "Failed to delete goal" };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  try {
    const response = await fetch(
      `/api/fhir/goal?id=${encodeURIComponent(goalFhirId)}`,
      { method: "DELETE" }
    );

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return { success: false, error: `Server error (${response.status})` };
    }

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || "Failed to delete goal",
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface GoalCreateResult {
  success: boolean;
  goalFhirId?: string;
  error?: string;
}

export async function createFhirGoal(
  goal: AppGoal,
  patientFhirId: string
): Promise<GoalCreateResult> {
  if (isLocalBackendClient()) {
    try {
      const response = await fetch("/api/clinical/goal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...goal, patientId: patientFhirId }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || "Failed to create goal" };
      }
      return { success: true, goalFhirId: data.id };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  try {
    const fhirResource = mapAppGoalToFhirGoal(goal, patientFhirId);
    delete (fhirResource as any).id;

    const response = await fetch("/api/fhir/goal", {
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
      return {
        success: false,
        error: data.error || "Failed to create goal",
      };
    }

    return { success: true, goalFhirId: data.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
