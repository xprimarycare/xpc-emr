import { FhirObservationBundle } from "@/lib/types/fhir";
import { AppVital } from "@/lib/types/vital";
import {
  mapFhirBundleToVitals,
  mapAppVitalToFhirObservation,
} from "@/lib/phenoml/fhir-mapper";

// --- Search & Upsert for VitalsTab ---

export interface VitalSearchResult {
  vitals: AppVital[];
  total: number;
  error?: string;
}

export async function searchFhirVitals(
  patientFhirId: string
): Promise<VitalSearchResult> {
  try {
    const response = await fetch(
      `/api/fhir/observation?patient=${encodeURIComponent(patientFhirId)}`
    );

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return { vitals: [], total: 0, error: `Server error (${response.status})` };
    }

    const data = await response.json();

    if (!response.ok) {
      return { vitals: [], total: 0, error: data.error || "Failed to fetch vitals" };
    }

    const bundle = data as FhirObservationBundle;
    const vitals = mapFhirBundleToVitals(bundle);

    return { vitals, total: bundle.total ?? vitals.length };
  } catch (error) {
    return {
      vitals: [],
      total: 0,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface VitalUpsertResult {
  success: boolean;
  error?: string;
}

export async function upsertFhirVital(
  vital: AppVital,
  patientFhirId: string
): Promise<VitalUpsertResult> {
  if (!vital.fhirId) {
    return { success: false, error: "Vital has no FHIR ID — cannot write back to Medplum" };
  }

  try {
    const fhirResource = mapAppVitalToFhirObservation(vital, patientFhirId);

    const response = await fetch("/api/fhir/observation", {
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
      return { success: false, error: (data as any).error || "Failed to save vital to Medplum" };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface VitalCreateResult {
  success: boolean;
  fhirId?: string;
  error?: string;
}

export async function createFhirVital(
  vital: AppVital,
  patientFhirId: string
): Promise<VitalCreateResult> {
  try {
    const fhirResource = mapAppVitalToFhirObservation(vital, patientFhirId);
    // Remove id for creation
    delete (fhirResource as any).id;

    const response = await fetch("/api/fhir/observation", {
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
      return { success: false, error: (data as any).error || "Failed to create vital" };
    }

    return { success: true, fhirId: (data as any).id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
