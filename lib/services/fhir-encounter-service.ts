import { FhirEncounterBundle, FhirClinicalImpressionBundle } from "@/lib/types/fhir";
import { AppEncounter } from "@/lib/types/encounter";
import {
  mapFhirBundleToEncounters,
  mapAppEncounterToFhirEncounter,
  mapAppEncounterToFhirClinicalImpression,
} from "@/lib/phenoml/fhir-mapper";
import { isLocalBackendClient } from "@/lib/emr-backend";

export interface EncounterSearchResult {
  encounters: AppEncounter[];
  total: number;
  error?: string;
}

/**
 * Fetch a patient's encounters (+ their clinical impressions) from EMR
 */
export async function searchFhirEncounters(
  patientFhirId: string
): Promise<EncounterSearchResult> {
  if (isLocalBackendClient()) {
    try {
      const response = await fetch(`/api/clinical/encounter?patient=${encodeURIComponent(patientFhirId)}`);
      const data = await response.json();
      if (!response.ok) {
        return { encounters: [], total: 0, error: data.error || "Failed to fetch encounters" };
      }
      return {
        encounters: data.items.map((i: any) => ({ ...i, fhirId: i.id, encounterFhirId: i.id })),
        total: data.total,
      };
    } catch (error) {
      return { encounters: [], total: 0, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  try {
    // Fetch encounters and clinical impressions in parallel
    const [encounterRes, impressionRes] = await Promise.all([
      fetch(`/api/fhir/encounter?patient=${encodeURIComponent(patientFhirId)}`),
      fetch(`/api/fhir/clinical-impression?patient=${encodeURIComponent(patientFhirId)}`),
    ]);

    const encounterContentType = encounterRes.headers.get("content-type");
    if (!encounterContentType?.includes("application/json")) {
      return {
        encounters: [],
        total: 0,
        error: `Server error (${encounterRes.status})`,
      };
    }

    const encounterData = await encounterRes.json();
    if (!encounterRes.ok) {
      return {
        encounters: [],
        total: 0,
        error: encounterData.error || "Failed to fetch encounters",
      };
    }

    let impressionBundle: FhirClinicalImpressionBundle | undefined;
    if (impressionRes.ok) {
      const impressionContentType = impressionRes.headers.get("content-type");
      if (impressionContentType?.includes("application/json")) {
        impressionBundle = await impressionRes.json();
      }
    }

    const encounterBundle = encounterData as FhirEncounterBundle;
    const encounters = mapFhirBundleToEncounters(encounterBundle, impressionBundle);

    return {
      encounters,
      total: encounterBundle.total ?? encounters.length,
    };
  } catch (error) {
    return {
      encounters: [],
      total: 0,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface EncounterCreateResult {
  success: boolean;
  encounterFhirId?: string;
  noteFhirId?: string;
  error?: string;
}

/**
 * Create a new encounter + clinical impression in EMR.
 * Creates the Encounter first, then creates a ClinicalImpression linked to it.
 */
export async function createFhirEncounter(
  enc: AppEncounter
): Promise<EncounterCreateResult> {
  if (isLocalBackendClient()) {
    try {
      const response = await fetch("/api/clinical/encounter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enc),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || "Failed to create encounter" };
      }
      return { success: true, encounterFhirId: data.id };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  try {
    // Step 1: Create the Encounter
    const fhirEncounter = mapAppEncounterToFhirEncounter(enc);
    // Remove id for creation (let the backend assign it)
    delete (fhirEncounter as any).id;

    const encounterRes = await fetch("/api/fhir/encounter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fhirEncounter),
    });

    const encounterContentType = encounterRes.headers.get("content-type");
    if (!encounterContentType?.includes("application/json")) {
      return { success: false, error: `Server error (${encounterRes.status})` };
    }

    const encounterData = await encounterRes.json();
    if (!encounterRes.ok) {
      return {
        success: false,
        error: encounterData.error || "Failed to create encounter",
      };
    }

    const encounterFhirId = encounterData.id;
    if (!encounterFhirId) {
      return { success: false, error: "Encounter created but no ID returned" };
    }

    // Step 2: Create the ClinicalImpression linked to the Encounter
    const fhirImpression = mapAppEncounterToFhirClinicalImpression(enc, encounterFhirId);
    // Remove id for creation (let the backend assign it)
    delete (fhirImpression as any).id;

    const impressionRes = await fetch("/api/fhir/clinical-impression", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fhirImpression),
    });

    let noteFhirId: string | undefined;
    if (impressionRes.ok) {
      const impressionContentType = impressionRes.headers.get("content-type");
      if (impressionContentType?.includes("application/json")) {
        const impressionData = await impressionRes.json();
        noteFhirId = impressionData.id;
      }
    }

    return {
      success: true,
      encounterFhirId,
      noteFhirId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface EncounterUpdateResult {
  success: boolean;
  error?: string;
}

/**
 * Update an existing encounter's note (ClinicalImpression upsert).
 * If the encounter itself needs updating, updates that too.
 */
export async function updateFhirEncounter(
  enc: AppEncounter
): Promise<EncounterUpdateResult> {
  if (isLocalBackendClient()) {
    try {
      const response = await fetch("/api/clinical/encounter", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...enc, id: enc.encounterFhirId }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || "Failed to update encounter" };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  if (!enc.encounterFhirId) {
    return {
      success: false,
      error: "Encounter has no FHIR ID - cannot update without an ID",
    };
  }

  try {
    // Update the Encounter resource
    const fhirEncounter = mapAppEncounterToFhirEncounter(enc);
    const encounterRes = await fetch("/api/fhir/encounter", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fhirEncounter),
    });

    if (!encounterRes.ok) {
      const encounterContentType = encounterRes.headers.get("content-type");
      if (encounterContentType?.includes("application/json")) {
        const data = await encounterRes.json();
        return { success: false, error: data.error || "Failed to update encounter" };
      }
      return { success: false, error: `Server error (${encounterRes.status})` };
    }

    // Update the ClinicalImpression if it exists
    if (enc.noteFhirId) {
      const fhirImpression = mapAppEncounterToFhirClinicalImpression(enc, enc.encounterFhirId);
      const impressionRes = await fetch("/api/fhir/clinical-impression", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fhirImpression),
      });

      if (!impressionRes.ok) {
        const impressionContentType = impressionRes.headers.get("content-type");
        if (impressionContentType?.includes("application/json")) {
          const data = await impressionRes.json();
          return { success: false, error: data.error || "Failed to update encounter note" };
        }
        return { success: false, error: `Server error (${impressionRes.status})` };
      }
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
