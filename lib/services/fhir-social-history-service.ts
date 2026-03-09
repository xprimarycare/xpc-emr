import { FhirSocialHistoryObservationBundle } from "@/lib/types/fhir";
import { AppSocialHistoryObservation } from "@/lib/types/social-history";
import {
  mapFhirBundleToSocialHistories,
  mapAppSocialHistoryToFhirObservation,
} from "@/lib/phenoml/fhir-mapper";
import {
  SOCIAL_HISTORY_CATEGORIES,
  SocialHistoryCategory,
} from "@/lib/data/social-history-categories";
import { isLocalBackendClient } from "@/lib/emr-backend";

export interface ResolvedSocialHistoryCode {
  code: string;
  description: string;
}

// Common social history abbreviations → expanded terms for LOINC semantic search
const SOCIAL_HISTORY_ABBREVIATIONS: Record<string, string> = {
  etoh: "alcohol use",
  tob: "tobacco use",
  ivdu: "intravenous drug use",
  ivda: "intravenous drug abuse",
  hx: "history",
  cigs: "cigarettes",
  ppd: "packs per day",
  pkyr: "pack years",
  mj: "marijuana use",
  thc: "cannabis use",
  ekg: "electrocardiogram",
  std: "sexually transmitted disease",
  sti: "sexually transmitted infection",
  hiv: "human immunodeficiency virus",
  edu: "education level",
  occ: "occupation",
  sober: "sobriety",
  dx: "diagnosis",
};

function expandSocialHistoryAbbreviations(text: string): string {
  return text.replace(/\b[a-zA-Z0-9]+\b/g, (word) => {
    const replacement = SOCIAL_HISTORY_ABBREVIATIONS[word.toLowerCase()];
    return replacement || word;
  });
}

export function parseSocialHistoryText(text: string): string[] {
  return text
    .split(/[,\n]+/)
    .flatMap((segment) => segment.split(/\band\b/i))
    .map((term) => expandSocialHistoryAbbreviations(term.trim()))
    .filter((term) => term.length > 0);
}

// ── Classification pipeline ──

export interface ClassifiedSocialHistoryEntry {
  originalText: string;
  category: SocialHistoryCategory | null;
  classificationMethod: "keyword" | "semantic" | "unclassified";
  displayValue: string;
}

/**
 * Classify a single entry by keyword matching against the category registry.
 * Returns the first matching category, or null.
 */
export function classifyByKeywords(
  text: string
): SocialHistoryCategory | null {
  const lower = text.toLowerCase();
  for (const category of SOCIAL_HISTORY_CATEGORIES) {
    for (const keyword of category.keywords) {
      if (typeof keyword === "string") {
        if (lower.includes(keyword)) return category;
      } else {
        const re = new RegExp(
          keyword.source,
          keyword.flags.includes("i") ? keyword.flags : keyword.flags + "i"
        );
        if (re.test(lower)) return category;
      }
    }
  }
  return null;
}

/**
 * Attempt to classify via PhenoML construe semantic search.
 * Searches LOINC for the text, then checks if any returned code
 * matches a known social history category.
 */
async function classifyBySemantic(
  text: string
): Promise<SocialHistoryCategory | null> {
  if (isLocalBackendClient()) {
    return null;
  }

  const result = await searchSocialHistoryCodes(text);
  if (result.error || result.codes.length === 0) return null;

  const categoryByCode = new Map<string, SocialHistoryCategory>();
  for (const cat of SOCIAL_HISTORY_CATEGORIES) {
    categoryByCode.set(cat.code, cat);
  }

  for (const code of result.codes) {
    const match = categoryByCode.get(code.code);
    if (match) return match;
  }
  return null;
}

export interface BatchClassifyResult {
  entries: ClassifiedSocialHistoryEntry[];
  error?: string;
}

/**
 * Two-stage classification pipeline:
 * 1. Parse text into entries (abbreviation expansion + splitting)
 * 2. For each entry: keyword match → PhenoML semantic fallback
 */
export async function classifySocialHistoryEntries(
  text: string
): Promise<BatchClassifyResult> {
  const terms = parseSocialHistoryText(text);
  if (terms.length === 0) {
    return { entries: [], error: "No social history entries found in text" };
  }

  try {
    const entries = await Promise.all(
      terms.map(async (term): Promise<ClassifiedSocialHistoryEntry> => {
        const displayValue = term.charAt(0).toUpperCase() + term.slice(1);

        // Stage 1: Keyword matching (fast, synchronous)
        const keywordMatch = classifyByKeywords(term);
        if (keywordMatch) {
          return {
            originalText: term,
            category: keywordMatch,
            classificationMethod: "keyword",
            displayValue,
          };
        }

        // Stage 2: PhenoML semantic fallback (async)
        const semanticMatch = await classifyBySemantic(term);
        if (semanticMatch) {
          return {
            originalText: term,
            category: semanticMatch,
            classificationMethod: "semantic",
            displayValue,
          };
        }

        return {
          originalText: term,
          category: null,
          classificationMethod: "unclassified",
          displayValue,
        };
      })
    );

    return { entries };
  } catch (error) {
    return {
      entries: terms.map((term) => ({
        originalText: term,
        category: null,
        classificationMethod: "unclassified" as const,
        displayValue: term.charAt(0).toUpperCase() + term.slice(1),
      })),
      error: error instanceof Error ? error.message : "Classification error",
    };
  }
}

export interface SocialHistoryCodeSearchResult {
  codes: ResolvedSocialHistoryCode[];
  error?: string;
}

export async function searchSocialHistoryCodes(
  text: string
): Promise<SocialHistoryCodeSearchResult> {
  if (isLocalBackendClient()) {
    try {
      const params = new URLSearchParams({ text, category: "social-history", limit: "5" });
      const response = await fetch(`/api/clinical/catalog?${params}`);
      const data = await response.json();
      if (!response.ok) {
        return { codes: [], error: data.error || "Failed to search social history codes" };
      }
      const codes: ResolvedSocialHistoryCode[] = (data.codes || []).map(
        (c: any) => ({ code: c.code, description: c.display })
      );
      return { codes };
    } catch (error) {
      return { codes: [], error: error instanceof Error ? error.message : "Network error" };
    }
  }

  try {
    const params = new URLSearchParams({
      codesystem: "LOINC",
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
        error: data.error || "Failed to search social history codes",
      };
    }

    const codes: ResolvedSocialHistoryCode[] = (data.results || []).map(
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

export interface ResolvedSocialHistoryEntry {
  term: string;
  code?: ResolvedSocialHistoryCode;
}

export interface BatchResolveSocialHistoryResult {
  entries: ResolvedSocialHistoryEntry[];
  error?: string;
}

export async function batchResolveSocialHistory(
  text: string
): Promise<BatchResolveSocialHistoryResult> {
  const terms = parseSocialHistoryText(text);
  if (terms.length === 0) {
    return { entries: [], error: "No social history entries found in text" };
  }

  try {
    const results = await Promise.all(
      terms.map(async (term): Promise<ResolvedSocialHistoryEntry> => {
        const result = await searchSocialHistoryCodes(term);
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

export interface SocialHistorySearchResult {
  observations: AppSocialHistoryObservation[];
  total: number;
  error?: string;
}

export async function searchFhirSocialHistories(
  patientFhirId: string
): Promise<SocialHistorySearchResult> {
  if (isLocalBackendClient()) {
    try {
      const response = await fetch(
        `/api/clinical/social-history?patient=${encodeURIComponent(patientFhirId)}`
      );
      const data = await response.json();
      if (!response.ok) {
        return { observations: [], total: 0, error: data.error || "Failed to fetch social history" };
      }
      const observations = (data.items || []).map((item: any) => ({ ...item, fhirId: item.id }));
      return { observations, total: data.total ?? observations.length };
    } catch (error) {
      return { observations: [], total: 0, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  try {
    const response = await fetch(
      `/api/fhir/social-history?patient=${encodeURIComponent(patientFhirId)}`
    );

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return {
        observations: [],
        total: 0,
        error: `Server error (${response.status})`,
      };
    }

    const data = await response.json();

    if (!response.ok) {
      return {
        observations: [],
        total: 0,
        error: data.error || "Failed to fetch social history",
      };
    }

    const bundle = data as FhirSocialHistoryObservationBundle;
    const observations = mapFhirBundleToSocialHistories(bundle);

    return {
      observations,
      total: bundle.total ?? observations.length,
    };
  } catch (error) {
    return {
      observations: [],
      total: 0,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface SocialHistoryUpsertResult {
  success: boolean;
  error?: string;
}

export async function upsertFhirSocialHistory(
  observation: AppSocialHistoryObservation,
  patientFhirId: string
): Promise<SocialHistoryUpsertResult> {
  if (isLocalBackendClient()) {
    try {
      const response = await fetch("/api/clinical/social-history", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...observation, id: observation.fhirId, patientId: patientFhirId }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || "Failed to save social history" };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  if (!observation.fhirId) {
    return {
      success: false,
      error: "Observation has no FHIR ID - cannot update without an ID",
    };
  }

  try {
    const fhirResource = mapAppSocialHistoryToFhirObservation(
      observation,
      patientFhirId
    );

    const response = await fetch("/api/fhir/social-history", {
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
        error: data.error || "Failed to save social history",
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

export interface SocialHistoryDeleteResult {
  success: boolean;
  error?: string;
}

export async function deleteFhirSocialHistory(
  observationFhirId: string
): Promise<SocialHistoryDeleteResult> {
  if (isLocalBackendClient()) {
    try {
      const response = await fetch(
        `/api/clinical/social-history?id=${encodeURIComponent(observationFhirId)}`,
        { method: "DELETE" }
      );
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || "Failed to delete social history" };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  try {
    const response = await fetch(
      `/api/fhir/social-history?id=${encodeURIComponent(observationFhirId)}`,
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
        error: data.error || "Failed to delete social history",
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

export interface SocialHistoryCreateResult {
  success: boolean;
  observationFhirId?: string;
  error?: string;
}

export async function createFhirSocialHistory(
  observation: AppSocialHistoryObservation,
  patientFhirId: string
): Promise<SocialHistoryCreateResult> {
  if (isLocalBackendClient()) {
    try {
      const response = await fetch("/api/clinical/social-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...observation, patientId: patientFhirId }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || "Failed to create social history" };
      }
      return { success: true, observationFhirId: data.id };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  try {
    const fhirResource = mapAppSocialHistoryToFhirObservation(
      observation,
      patientFhirId
    );
    delete (fhirResource as any).id;

    const response = await fetch("/api/fhir/social-history", {
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
        error: data.error || "Failed to create social history",
      };
    }

    return { success: true, observationFhirId: data.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
