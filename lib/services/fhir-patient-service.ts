import { FhirPatientBundle } from "@/lib/types/fhir";
import { Patient, PatientData } from "@/lib/types/patient";
import {
  mapFhirBundleToPatients,
  mapAppPatientToFhirPatient,
} from "@/lib/phenoml/fhir-mapper";
import { isLocalBackendClient } from "@/lib/emr-backend";
import { createDefaultTabs } from "@/lib/data/default-tabs";

function mapLocalPatient(i: any): PatientData {
  return {
    id: i.id,
    fhirId: i.id,
    name: i.name || "",
    mrn: i.mrn || "",
    dob: i.dob || "",
    sex: i.sex || "",
    avatar: i.avatar,
    summary: i.summary,
    tabs: createDefaultTabs({ name: i.name || "", mrn: i.mrn || "", dob: i.dob || "", sex: i.sex || "" }),
  };
}

export interface PatientSearchResult {
  patients: PatientData[];
  total: number;
  error?: string;
}

/**
 * List all patients from FHIR via PhenoML (no search filter)
 */
export async function listFhirPatients(): Promise<PatientSearchResult> {
  if (isLocalBackendClient()) {
    try {
      const response = await fetch("/api/clinical/patient");
      const data = await response.json();
      if (!response.ok) {
        return { patients: [], total: 0, error: data.error || "Failed to list patients" };
      }
      return {
        patients: data.items.map((i: any) => mapLocalPatient(i)),
        total: data.total,
      };
    } catch (error) {
      return { patients: [], total: 0, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  try {
    const response = await fetch("/api/fhir/patient");

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return {
        patients: [],
        total: 0,
        error: `Server error (${response.status})`,
      };
    }

    const data = await response.json();

    if (!response.ok) {
      return {
        patients: [],
        total: 0,
        error: data.error || "Failed to list patients",
      };
    }

    const bundle = data as FhirPatientBundle;
    const patients = mapFhirBundleToPatients(bundle);

    return {
      patients,
      total: bundle.total ?? patients.length,
    };
  } catch (error) {
    return {
      patients: [],
      total: 0,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

/**
 * Search for patients in FHIR via PhenoML
 */
export async function searchFhirPatients(name: string): Promise<PatientSearchResult> {
  if (isLocalBackendClient()) {
    try {
      const response = await fetch(`/api/clinical/patient?name=${encodeURIComponent(name)}`);
      const data = await response.json();
      if (!response.ok) {
        return { patients: [], total: 0, error: data.error || "Failed to search patients" };
      }
      return {
        patients: data.items.map((i: any) => mapLocalPatient(i)),
        total: data.total,
      };
    } catch (error) {
      return { patients: [], total: 0, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  try {
    const response = await fetch(
      `/api/fhir/patient?name=${encodeURIComponent(name)}`
    );

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return {
        patients: [],
        total: 0,
        error: `Server error (${response.status})`,
      };
    }

    const data = await response.json();

    if (!response.ok) {
      return {
        patients: [],
        total: 0,
        error: data.error || "Failed to search patients",
      };
    }

    const bundle = data as FhirPatientBundle;
    const patients = mapFhirBundleToPatients(bundle);

    return {
      patients,
      total: bundle.total ?? patients.length,
    };
  } catch (error) {
    return {
      patients: [],
      total: 0,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface PatientCreateResult {
  success: boolean;
  fhirId?: string;
  error?: string;
}

/**
 * Create a new patient in EMR lang2fhir.
 * Returns the server-assigned fhirId on success.
 */
export async function createFhirPatient(patient: {
  name: string;
  sex: string;
  dob: string;
}): Promise<PatientCreateResult> {
  if (isLocalBackendClient()) {
    try {
      const response = await fetch("/api/clinical/patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: patient.name, sex: patient.sex, dob: patient.dob }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || "Failed to create patient" };
      }
      return { success: true, fhirId: data.id };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  try {
    const response = await fetch("/api/fhir/patient", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: patient.name,
        gender: patient.sex.toLowerCase(),
        dateOfBirth: patient.dob,
      }),
    });

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return { success: false, error: `Server error (${response.status})` };
    }

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || "Failed to create patient",
      };
    }

    return { success: true, fhirId: data.fhirId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export interface PatientUpsertResult {
  success: boolean;
  error?: string;
}

/**
 * Write patient data back via PUT upsert.
 * Only works for FHIR-imported patients (those with a fhirId).
 */
export async function upsertFhirPatient(
  patient: Patient
): Promise<PatientUpsertResult> {
  if (isLocalBackendClient()) {
    try {
      const response = await fetch("/api/clinical/patient", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: patient.fhirId,
          name: patient.name,
          dob: patient.dob,
          sex: patient.sex,
          mrn: patient.mrn,
          avatar: patient.avatar,
          summary: patient.summary,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || "Failed to update patient" };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
  }

  if (!patient.fhirId) {
    return {
      success: false,
      error: "Patient has no FHIR ID - cannot update without an ID",
    };
  }

  try {
    const fhirResource = mapAppPatientToFhirPatient(patient);

    const response = await fetch("/api/fhir/patient", {
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
        error: data.error || "Failed to save patient",
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
