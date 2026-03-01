import { FhirPatientBundle } from "@/lib/types/fhir";
import { Patient, PatientData } from "@/lib/types/patient";
import {
  mapFhirBundleToPatients,
  mapAppPatientToFhirPatient,
} from "@/lib/phenoml/fhir-mapper";

export interface PatientSearchResult {
  patients: PatientData[];
  total: number;
  error?: string;
}

/**
 * List all patients from FHIR via PhenoML (no search filter)
 */
export async function listFhirPatients(): Promise<PatientSearchResult> {
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
 * Create a new patient in Medplum via PhenoML lang2fhir.
 * Returns the server-assigned fhirId on success.
 */
export async function createFhirPatient(patient: {
  name: string;
  sex: string;
  dob: string;
}): Promise<PatientCreateResult> {
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
        error: data.error || "Failed to create patient in Medplum",
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
 * Write patient data back to Medplum via PUT upsert.
 * Only works for FHIR-imported patients (those with a fhirId).
 */
export async function upsertFhirPatient(
  patient: Patient
): Promise<PatientUpsertResult> {
  if (!patient.fhirId) {
    return {
      success: false,
      error: "Patient has no FHIR ID - cannot write back to Medplum",
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
        error: data.error || "Failed to save patient to Medplum",
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
