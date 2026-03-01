import { FhirConditionBundle } from "@/lib/types/fhir";
import { AppCondition } from "@/lib/types/condition";
import {
  mapFhirBundleToConditions,
  mapAppConditionToFhirCondition,
} from "@/lib/phenoml/fhir-mapper";

export interface ResolvedDiagnosisCode {
  code: string;
  description: string;
}

export interface DiagnosisCodeSearchResult {
  codes: ResolvedDiagnosisCode[];
  error?: string;
}

// Common medical abbreviations → expanded terms for ICD-10 semantic search
const DIAGNOSIS_ABBREVIATIONS: Record<string, string> = {
  dm: "diabetes mellitus",
  dm1: "type 1 diabetes mellitus",
  dm2: "type 2 diabetes mellitus",
  htn: "hypertension",
  ckd: "chronic kidney disease",
  chf: "congestive heart failure",
  cad: "coronary artery disease",
  copd: "chronic obstructive pulmonary disease",
  afib: "atrial fibrillation",
  mi: "myocardial infarction",
  cva: "cerebrovascular accident stroke",
  dvt: "deep vein thrombosis",
  pe: "pulmonary embolism",
  gerd: "gastroesophageal reflux disease",
  osa: "obstructive sleep apnea",
  bph: "benign prostatic hyperplasia",
  uti: "urinary tract infection",
  ra: "rheumatoid arthritis",
  oa: "osteoarthritis",
  sle: "systemic lupus erythematosus",
  ms: "multiple sclerosis",
  ibs: "irritable bowel syndrome",
  pud: "peptic ulcer disease",
  tia: "transient ischemic attack",
  pad: "peripheral arterial disease",
  esrd: "end stage renal disease",
  hld: "hyperlipidemia",
  hypothyroid: "hypothyroidism",
  hyperthyroid: "hyperthyroidism",
  anx: "anxiety disorder",
  mdd: "major depressive disorder",
  bipolar: "bipolar disorder",
  sz: "seizure disorder epilepsy",
  pvd: "peripheral vascular disease",
  aaa: "abdominal aortic aneurysm",
};

function expandDiagnosisAbbreviations(text: string): string {
  return text.replace(/\b[a-zA-Z0-9]+\b/g, (word) => {
    const replacement = DIAGNOSIS_ABBREVIATIONS[word.toLowerCase()];
    return replacement || word;
  });
}

/**
 * Parse free text into individual diagnosis terms.
 * Splits on commas, newlines, and the word "and".
 * Expands common abbreviations.
 */
export function parseDiagnosisText(text: string): string[] {
  return text
    .split(/[,\n]+/)
    .flatMap((segment) => segment.split(/\band\b/i))
    .map((term) => expandDiagnosisAbbreviations(term.trim()))
    .filter((term) => term.length > 0);
}

/**
 * Search ICD-10 diagnosis codes via PhenoML construe semantic search.
 */
export async function searchDiagnosisCodes(
  text: string
): Promise<DiagnosisCodeSearchResult> {
  try {
    const params = new URLSearchParams({
      codesystem: "ICD10CM",
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
      return { codes: [], error: data.error || "Failed to search diagnosis codes" };
    }

    const codes: ResolvedDiagnosisCode[] = (data.results || []).map(
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

export interface ResolvedConditionEntry {
  /** Original term the user typed */
  term: string;
  /** Best ICD-10 match (if resolved) */
  code?: ResolvedDiagnosisCode;
}

export interface BatchResolveResult {
  entries: ResolvedConditionEntry[];
  error?: string;
}

/**
 * Parse free text into terms, resolve each to an ICD-10 code in parallel.
 * Returns the top match for each term.
 */
export async function batchResolveDiagnoses(
  text: string
): Promise<BatchResolveResult> {
  const terms = parseDiagnosisText(text);
  if (terms.length === 0) {
    return { entries: [], error: "No conditions found in text" };
  }

  try {
    const results = await Promise.all(
      terms.map(async (term): Promise<ResolvedConditionEntry> => {
        const result = await searchDiagnosisCodes(term);
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

export interface ConditionSearchResult {
  conditions: AppCondition[];
  total: number;
  error?: string;
}

/**
 * Fetch a patient's conditions from Medplum via PhenoML
 */
export async function searchFhirConditions(
  patientFhirId: string
): Promise<ConditionSearchResult> {
  try {
    const response = await fetch(
      `/api/fhir/condition?patient=${encodeURIComponent(patientFhirId)}`
    );

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return {
        conditions: [],
        total: 0,
        error: `Server error (${response.status})`,
      };
    }

    const data = await response.json();

    if (!response.ok) {
      return {
        conditions: [],
        total: 0,
        error: data.error || "Failed to fetch conditions",
      };
    }

    const bundle = data as FhirConditionBundle;
    const conditions = mapFhirBundleToConditions(bundle);

    return {
      conditions,
      total: bundle.total ?? conditions.length,
    };
  } catch (error) {
    return {
      conditions: [],
      total: 0,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface ConditionUpsertResult {
  success: boolean;
  error?: string;
}

/**
 * Write a condition back to Medplum via PUT upsert.
 */
export async function upsertFhirCondition(
  condition: AppCondition,
  patientFhirId: string
): Promise<ConditionUpsertResult> {
  if (!condition.fhirId) {
    return {
      success: false,
      error: "Condition has no FHIR ID - cannot write back to Medplum",
    };
  }

  try {
    const fhirResource = mapAppConditionToFhirCondition(condition, patientFhirId);

    const response = await fetch("/api/fhir/condition", {
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
        error: data.error || "Failed to save condition to Medplum",
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

export interface ConditionDeleteResult {
  success: boolean;
  error?: string;
}

/**
 * Delete a condition from Medplum via DELETE.
 */
export async function deleteFhirCondition(
  conditionFhirId: string
): Promise<ConditionDeleteResult> {
  try {
    const response = await fetch(
      `/api/fhir/condition?id=${encodeURIComponent(conditionFhirId)}`,
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
        error: data.error || "Failed to delete condition from Medplum",
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

export interface ConditionCreateResult {
  success: boolean;
  conditionFhirId?: string;
  error?: string;
}

/**
 * Create a new condition in Medplum via POST.
 */
export async function createFhirCondition(
  condition: AppCondition,
  patientFhirId: string
): Promise<ConditionCreateResult> {
  try {
    const fhirResource = mapAppConditionToFhirCondition(condition, patientFhirId);
    // Remove id for creation (let Medplum assign it)
    delete (fhirResource as any).id;

    const response = await fetch("/api/fhir/condition", {
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
        error: data.error || "Failed to create condition in Medplum",
      };
    }

    return { success: true, conditionFhirId: data.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
