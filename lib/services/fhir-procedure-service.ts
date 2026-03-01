import { FhirProcedureBundle } from "@/lib/types/fhir";
import { AppProcedure } from "@/lib/types/procedure";
import {
  mapFhirBundleToProcedures,
  mapAppProcedureToFhirProcedure,
} from "@/lib/phenoml/fhir-mapper";

export interface ResolvedProcedureCode {
  code: string;
  description: string;
}

// Common surgical abbreviations → expanded terms for SNOMED semantic search
const PROCEDURE_ABBREVIATIONS: Record<string, string> = {
  appy: "appendectomy",
  chole: "cholecystectomy",
  cabg: "coronary artery bypass graft",
  turp: "transurethral resection of prostate",
  lap: "laparoscopic surgery",
  tkr: "total knee replacement",
  thr: "total hip replacement",
  tka: "total knee arthroplasty",
  tha: "total hip arthroplasty",
  orif: "open reduction internal fixation",
  ercp: "endoscopic retrograde cholangiopancreatography",
  egd: "esophagogastroduodenoscopy",
  ptca: "percutaneous transluminal coronary angioplasty",
  tavr: "transcatheter aortic valve replacement",
  avr: "aortic valve replacement",
  mvr: "mitral valve replacement",
  acl: "anterior cruciate ligament reconstruction",
  lami: "laminectomy",
  discectomy: "discectomy",
  tonsillectomy: "tonsillectomy",
  hysterectomy: "hysterectomy",
  mastectomy: "mastectomy",
  nephrectomy: "nephrectomy",
  colectomy: "colectomy",
  gastrectomy: "gastrectomy",
  thyroidectomy: "thyroidectomy",
  csection: "cesarean section",
};

function expandProcedureAbbreviations(text: string): string {
  return text.replace(/\b[a-zA-Z0-9]+\b/g, (word) => {
    const replacement = PROCEDURE_ABBREVIATIONS[word.toLowerCase()];
    return replacement || word;
  });
}

export function parseProcedureText(text: string): string[] {
  return text
    .split(/[,\n]+/)
    .flatMap((segment) => segment.split(/\band\b/i))
    .map((term) => expandProcedureAbbreviations(term.trim()))
    .filter((term) => term.length > 0);
}

export interface ProcedureCodeSearchResult {
  codes: ResolvedProcedureCode[];
  error?: string;
}

export async function searchProcedureCodes(
  text: string
): Promise<ProcedureCodeSearchResult> {
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
        error: data.error || "Failed to search procedure codes",
      };
    }

    const codes: ResolvedProcedureCode[] = (data.results || []).map(
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

export interface ResolvedProcedureEntry {
  term: string;
  code?: ResolvedProcedureCode;
}

export interface BatchResolveResult {
  entries: ResolvedProcedureEntry[];
  error?: string;
}

export async function batchResolveProcedures(
  text: string
): Promise<BatchResolveResult> {
  const terms = parseProcedureText(text);
  if (terms.length === 0) {
    return { entries: [], error: "No procedures found in text" };
  }

  try {
    const results = await Promise.all(
      terms.map(async (term): Promise<ResolvedProcedureEntry> => {
        const result = await searchProcedureCodes(term);
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

export interface ProcedureSearchResult {
  procedures: AppProcedure[];
  total: number;
  error?: string;
}

export async function searchFhirProcedures(
  patientFhirId: string
): Promise<ProcedureSearchResult> {
  try {
    const response = await fetch(
      `/api/fhir/procedure?patient=${encodeURIComponent(patientFhirId)}`
    );

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return {
        procedures: [],
        total: 0,
        error: `Server error (${response.status})`,
      };
    }

    const data = await response.json();

    if (!response.ok) {
      return {
        procedures: [],
        total: 0,
        error: data.error || "Failed to fetch procedures",
      };
    }

    const bundle = data as FhirProcedureBundle;
    const procedures = mapFhirBundleToProcedures(bundle);

    return {
      procedures,
      total: bundle.total ?? procedures.length,
    };
  } catch (error) {
    return {
      procedures: [],
      total: 0,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface ProcedureUpsertResult {
  success: boolean;
  error?: string;
}

export async function upsertFhirProcedure(
  procedure: AppProcedure,
  patientFhirId: string
): Promise<ProcedureUpsertResult> {
  if (!procedure.fhirId) {
    return {
      success: false,
      error: "Procedure has no FHIR ID - cannot write back to Medplum",
    };
  }

  try {
    const fhirResource = mapAppProcedureToFhirProcedure(
      procedure,
      patientFhirId
    );

    const response = await fetch("/api/fhir/procedure", {
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
        error: data.error || "Failed to save procedure to Medplum",
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

export interface ProcedureDeleteResult {
  success: boolean;
  error?: string;
}

export async function deleteFhirProcedure(
  procedureFhirId: string
): Promise<ProcedureDeleteResult> {
  try {
    const response = await fetch(
      `/api/fhir/procedure?id=${encodeURIComponent(procedureFhirId)}`,
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
        error: data.error || "Failed to delete procedure from Medplum",
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

export interface ProcedureCreateResult {
  success: boolean;
  procedureFhirId?: string;
  error?: string;
}

export async function createFhirProcedure(
  procedure: AppProcedure,
  patientFhirId: string
): Promise<ProcedureCreateResult> {
  try {
    const fhirResource = mapAppProcedureToFhirProcedure(
      procedure,
      patientFhirId
    );
    delete (fhirResource as any).id;

    const response = await fetch("/api/fhir/procedure", {
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
        error: data.error || "Failed to create procedure in Medplum",
      };
    }

    return { success: true, procedureFhirId: data.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
