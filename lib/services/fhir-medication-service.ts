import { FhirMedicationRequestBundle } from "@/lib/types/fhir";
import { AppMedication } from "@/lib/types/medication";
import {
  mapFhirBundleToMedications,
  mapAppMedicationToFhirMedRequest,
} from "@/lib/phenoml/fhir-mapper";

export interface MedicationSearchResult {
  medications: AppMedication[];
  total: number;
  error?: string;
}

/**
 * Fetch a patient's medications from Medplum via PhenoML
 */
export async function searchFhirMedications(
  patientFhirId: string
): Promise<MedicationSearchResult> {
  try {
    const response = await fetch(
      `/api/fhir/medication?patient=${encodeURIComponent(patientFhirId)}`
    );

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return {
        medications: [],
        total: 0,
        error: `Server error (${response.status})`,
      };
    }

    const data = await response.json();

    if (!response.ok) {
      return {
        medications: [],
        total: 0,
        error: data.error || "Failed to fetch medications",
      };
    }

    const bundle = data as FhirMedicationRequestBundle;
    const medications = mapFhirBundleToMedications(bundle);

    return {
      medications,
      total: bundle.total ?? medications.length,
    };
  } catch (error) {
    return {
      medications: [],
      total: 0,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface MedicationParseResult {
  resource: Record<string, unknown> | null;
  error?: string;
}

/**
 * Parse natural language medication text via PhenoML lang2fhir.
 * Returns the raw FHIR MedicationRequest resource (not yet written to Medplum).
 */
export async function parseMedicationText(
  text: string
): Promise<MedicationParseResult> {
  try {
    const response = await fetch("/api/fhir/lang2fhir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, resource: "medicationrequest" }),
    });

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return { resource: null, error: `Server error (${response.status})` };
    }

    const data = await response.json();

    if (!response.ok) {
      return { resource: null, error: data.error || "Failed to parse medication" };
    }

    return { resource: data };
  } catch (error) {
    return {
      resource: null,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface MedicationCreateResult {
  success: boolean;
  fhirId?: string;
  error?: string;
}

/**
 * Create a new MedicationRequest in Medplum.
 * Accepts a raw FHIR resource (from lang2fhir parse) with patient reference injected.
 */
export async function createFhirMedication(
  fhirResource: Record<string, unknown>
): Promise<MedicationCreateResult> {
  try {
    const response = await fetch("/api/fhir/medication", {
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
      return { success: false, error: data.error || "Failed to create medication" };
    }

    return { success: true, fhirId: (data as any).id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface MedicationUpsertResult {
  success: boolean;
  error?: string;
}

/**
 * Write a medication back to Medplum via PUT upsert.
 */
export async function upsertFhirMedication(
  med: AppMedication,
  patientFhirId: string
): Promise<MedicationUpsertResult> {
  if (!med.fhirId) {
    return {
      success: false,
      error: "Medication has no FHIR ID - cannot write back to Medplum",
    };
  }

  try {
    const fhirResource = mapAppMedicationToFhirMedRequest(med, patientFhirId);

    const response = await fetch("/api/fhir/medication", {
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
        error: data.error || "Failed to save medication to Medplum",
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
