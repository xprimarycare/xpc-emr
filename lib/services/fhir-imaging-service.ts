import { FhirServiceRequestBundle } from "@/lib/types/fhir";
import { AppImagingOrder } from "@/lib/types/imaging";
import {
  mapFhirBundleToImagingOrders,
  mapAppImagingOrderToFhirServiceRequest,
} from "@/lib/phenoml/fhir-mapper";
import { isLocalBackendClient } from "@/lib/emr-backend";

export interface ResolvedCode {
  code: string;
  description: string;
}

export interface ImagingCodeResolveResult {
  codes: ResolvedCode[];
  error?: string;
}

/**
 * Common imaging abbreviations expanded before sending to PhenoML semantic search.
 */
const IMAGING_ABBREVIATIONS: Record<string, string> = {
  cxr: "chest x-ray",
  xr: "x-ray",
  ct: "CT scan",
  mri: "MRI",
  us: "ultrasound",
  echo: "echocardiogram",
  dexa: "DEXA bone density scan",
  mammo: "mammogram",
  fluoro: "fluoroscopy",
  pet: "PET scan",
  angio: "angiography",
};

function expandImagingAbbreviations(text: string): string {
  return text.replace(/\b[a-zA-Z0-9]+\b/g, (word) => {
    const replacement = IMAGING_ABBREVIATIONS[word.toLowerCase()];
    return replacement || word;
  });
}

// --- Starred imaging code preferences (persisted in localStorage) ---

const STARRED_IMAGING_KEY = "pineapplej-starred-imaging-codes";

function getStarredImagingCodes(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STARRED_IMAGING_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveStarredImagingCodes(codes: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STARRED_IMAGING_KEY, JSON.stringify([...codes]));
}

export function starImagingCode(loincCode: string) {
  const starred = getStarredImagingCodes();
  starred.add(loincCode);
  saveStarredImagingCodes(starred);
}

export function unstarImagingCode(loincCode: string) {
  const starred = getStarredImagingCodes();
  starred.delete(loincCode);
  saveStarredImagingCodes(starred);
}

export function isImagingCodeStarred(loincCode: string): boolean {
  return getStarredImagingCodes().has(loincCode);
}

function sortByStarred(codes: ResolvedCode[]): ResolvedCode[] {
  const starred = getStarredImagingCodes();
  if (starred.size === 0) return codes;
  return [...codes].sort((a, b) => {
    const aStarred = starred.has(a.code) ? 0 : 1;
    const bStarred = starred.has(b.code) ? 0 : 1;
    return aStarred - bStarred;
  });
}

/**
 * Resolve imaging study names to LOINC codes via PhenoML semantic search.
 */
export async function resolveImagingCodes(
  text: string
): Promise<ImagingCodeResolveResult> {
  if (isLocalBackendClient()) {
    try {
      const expandedText = expandImagingAbbreviations(text);
      const params = new URLSearchParams({ text: expandedText, category: "imaging", limit: "10" });
      const response = await fetch(`/api/clinical/catalog?${params}`);
      const data = await response.json();
      if (!response.ok) {
        return { codes: [], error: data.error || "Failed to resolve imaging codes" };
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
    const expandedText = expandImagingAbbreviations(text);
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
      return { codes: [], error: data.error || "Failed to resolve imaging codes" };
    }

    // Semantic search returns { system, results: [{ code, description }] }
    const results: ResolvedCode[] = (data.results || []).map((r: any) => ({
      code: r.code,
      description: r.description || r.code,
    }));

    return { codes: sortByStarred(results) };
  } catch (error) {
    return {
      codes: [],
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

// --- CRUD wrappers ---

export interface ImagingOrderCreateResult {
  success: boolean;
  fhirId?: string;
  error?: string;
}

export async function createFhirImagingOrder(
  fhirResource: Record<string, unknown>
): Promise<ImagingOrderCreateResult> {
  if (isLocalBackendClient()) {
    try {
      const response = await fetch("/api/clinical/imaging", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fhirResource),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || "Failed to create imaging order" };
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
      return { success: false, error: data.error || "Failed to create imaging order" };
    }

    return { success: true, fhirId: (data as any).id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

// --- Search & Upsert for ImagingTab ---

export interface ImagingOrderSearchResult {
  imagingOrders: AppImagingOrder[];
  total: number;
  error?: string;
}

export async function searchFhirImagingOrders(
  patientFhirId: string
): Promise<ImagingOrderSearchResult> {
  if (isLocalBackendClient()) {
    try {
      const response = await fetch(
        `/api/clinical/imaging?patient=${encodeURIComponent(patientFhirId)}`
      );
      const data = await response.json();
      if (!response.ok) {
        return { imagingOrders: [], total: 0, error: data.error || "Failed to fetch imaging orders" };
      }
      const imagingOrders = (data.items || []).map((item: any) => ({ ...item, fhirId: item.id }));
      return { imagingOrders, total: data.total ?? imagingOrders.length };
    } catch (error) {
      return { imagingOrders: [], total: 0, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  try {
    const response = await fetch(
      `/api/fhir/service-request?patient=${encodeURIComponent(patientFhirId)}`
    );

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return { imagingOrders: [], total: 0, error: `Server error (${response.status})` };
    }

    const data = await response.json();

    if (!response.ok) {
      return { imagingOrders: [], total: 0, error: data.error || "Failed to fetch imaging orders" };
    }

    const bundle = data as FhirServiceRequestBundle;
    const imagingOrders = mapFhirBundleToImagingOrders(bundle);

    return { imagingOrders, total: imagingOrders.length };
  } catch (error) {
    return {
      imagingOrders: [],
      total: 0,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface ImagingOrderUpsertResult {
  success: boolean;
  error?: string;
}

export async function upsertFhirImagingOrder(
  img: AppImagingOrder
): Promise<ImagingOrderUpsertResult> {
  if (isLocalBackendClient()) {
    try {
      const response = await fetch("/api/clinical/imaging", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...img, id: img.fhirId }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || "Failed to save imaging order" };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  if (!img.fhirId) {
    return { success: false, error: "Imaging order has no FHIR ID — cannot update without an ID" };
  }

  try {
    const fhirResource = mapAppImagingOrderToFhirServiceRequest(img);

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
      return { success: false, error: (data as any).error || "Failed to save imaging order" };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
