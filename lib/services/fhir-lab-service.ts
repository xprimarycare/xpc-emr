import { FhirServiceRequestBundle } from "@/lib/types/fhir";
import { AppLabOrder } from "@/lib/types/lab";
import {
  mapFhirBundleToLabOrders,
  mapAppLabOrderToFhirServiceRequest,
} from "@/lib/phenoml/fhir-mapper";
import { isLocalBackendClient } from "@/lib/emr-backend";

export interface ResolvedCode {
  code: string;
  description: string;
}

export interface LabCodeResolveResult {
  codes: ResolvedCode[];
  error?: string;
}

/**
 * Common lab abbreviations expanded before sending to PhenoML semantic search.
 * Semantic search handles most abbreviations natively, but these ensure
 * consistent results for the most common clinical shorthand.
 */
const LAB_ABBREVIATIONS: Record<string, string> = {
  cmp: "comprehensive metabolic panel",
  bmp: "basic metabolic panel",
  cbc: "complete blood count",
  tsh: "TSH thyroid stimulating hormone blood test",
  hba1c: "HbA1c blood test",
  a1c: "HbA1c blood test",
  lfts: "liver function panel",
  lft: "liver function panel",
  ua: "urinalysis",
  pt: "prothrombin time",
  inr: "international normalized ratio",
  ptt: "partial thromboplastin time",
  esr: "erythrocyte sedimentation rate",
  crp: "c-reactive protein",
  bnp: "brain natriuretic peptide",
  psa: "prostate specific antigen",
};

function expandLabAbbreviations(text: string): string {
  return text.replace(/\b[a-zA-Z0-9]+\b/g, (word) => {
    const replacement = LAB_ABBREVIATIONS[word.toLowerCase()];
    return replacement || word;
  });
}

// --- Starred lab code preferences (persisted in localStorage) ---

const STARRED_LABS_KEY = "pineapplej-starred-lab-codes";

function getStarredLabCodes(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STARRED_LABS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveStarredLabCodes(codes: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STARRED_LABS_KEY, JSON.stringify([...codes]));
}

export function starLabCode(loincCode: string) {
  const starred = getStarredLabCodes();
  starred.add(loincCode);
  saveStarredLabCodes(starred);
}

export function unstarLabCode(loincCode: string) {
  const starred = getStarredLabCodes();
  starred.delete(loincCode);
  saveStarredLabCodes(starred);
}

export function isLabCodeStarred(loincCode: string): boolean {
  return getStarredLabCodes().has(loincCode);
}

function sortByStarred(codes: ResolvedCode[]): ResolvedCode[] {
  const starred = getStarredLabCodes();
  if (starred.size === 0) return codes;
  return [...codes].sort((a, b) => {
    const aStarred = starred.has(a.code) ? 0 : 1;
    const bStarred = starred.has(b.code) ? 0 : 1;
    return aStarred - bStarred;
  });
}

/**
 * Resolve lab test names to LOINC codes via PhenoML semantic search.
 */
export async function resolveLabCodes(
  text: string
): Promise<LabCodeResolveResult> {
  if (isLocalBackendClient()) {
    try {
      const expandedText = expandLabAbbreviations(text);
      const params = new URLSearchParams({ text: expandedText, category: "lab", limit: "10" });
      const response = await fetch(`/api/clinical/catalog?${params}`);
      const data = await response.json();
      if (!response.ok) {
        return { codes: [], error: data.error || "Failed to resolve lab codes" };
      }
      const codes: ResolvedCode[] = (data.codes || []).map(
        (c: any) => ({ code: c.code, description: c.display })
      );
      return { codes: sortByStarred(codes) };
    } catch (error) {
      return { codes: [], error: error instanceof Error ? error.message : "Network error" };
    }
  }

  try {
    const expandedText = expandLabAbbreviations(text);
    const params = new URLSearchParams({
      codesystem: "LOINC",
      text: expandedText,
      limit: "10",
    });
    const response = await fetch(`/api/fhir/construe/semantic?${params}`);

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return { codes: [], error: `Server error (${response.status})` };
    }

    const data = await response.json();

    if (!response.ok) {
      return { codes: [], error: data.error || "Failed to resolve lab codes" };
    }

    // Semantic search returns { system, results: [{ code, description }] }
    const extractedCodes: ResolvedCode[] = (data.results || [])
      .map((r: any) => ({
        code: r.code,
        description: r.description || r.code,
      }));

    return { codes: sortByStarred(extractedCodes) };
  } catch (error) {
    return {
      codes: [],
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface LabOrderCreateResult {
  success: boolean;
  fhirId?: string;
  error?: string;
}

/**
 * Create a new ServiceRequest (lab order) in EMR.
 */
export async function createFhirLabOrder(
  fhirResource: Record<string, unknown>
): Promise<LabOrderCreateResult> {
  if (isLocalBackendClient()) {
    try {
      const response = await fetch("/api/clinical/lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fhirResource),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || "Failed to create lab order" };
      }
      return { success: true, fhirId: data.id };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  try {
    const response = await fetch("/api/fhir/service-request", {
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
      return { success: false, error: data.error || "Failed to create lab order" };
    }

    return { success: true, fhirId: (data as any).id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

// --- Search & Upsert for LabsTab ---

export interface LabOrderSearchResult {
  labOrders: AppLabOrder[];
  total: number;
  error?: string;
}

export async function searchFhirLabOrders(
  patientFhirId: string
): Promise<LabOrderSearchResult> {
  if (isLocalBackendClient()) {
    try {
      const response = await fetch(
        `/api/clinical/lab?patient=${encodeURIComponent(patientFhirId)}`
      );
      const data = await response.json();
      if (!response.ok) {
        return { labOrders: [], total: 0, error: data.error || "Failed to fetch lab orders" };
      }
      const labOrders = (data.items || []).map((item: any) => ({ ...item, fhirId: item.id }));
      return { labOrders, total: data.total ?? labOrders.length };
    } catch (error) {
      return { labOrders: [], total: 0, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  try {
    const response = await fetch(
      `/api/fhir/service-request?patient=${encodeURIComponent(patientFhirId)}`
    );

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return { labOrders: [], total: 0, error: `Server error (${response.status})` };
    }

    const data = await response.json();

    if (!response.ok) {
      return { labOrders: [], total: 0, error: data.error || "Failed to fetch lab orders" };
    }

    const bundle = data as FhirServiceRequestBundle;
    const labOrders = mapFhirBundleToLabOrders(bundle);

    return { labOrders, total: bundle.total ?? labOrders.length };
  } catch (error) {
    return {
      labOrders: [],
      total: 0,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface LabOrderUpsertResult {
  success: boolean;
  error?: string;
}

export async function upsertFhirLabOrder(
  lab: AppLabOrder
): Promise<LabOrderUpsertResult> {
  if (isLocalBackendClient()) {
    try {
      const response = await fetch("/api/clinical/lab", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...lab, id: lab.fhirId }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || "Failed to save lab order" };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  if (!lab.fhirId) {
    return { success: false, error: "Lab order has no FHIR ID — cannot update without an ID" };
  }

  try {
    const fhirResource = mapAppLabOrderToFhirServiceRequest(lab);

    const response = await fetch("/api/fhir/service-request", {
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
      return { success: false, error: (data as any).error || "Failed to save lab order" };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
