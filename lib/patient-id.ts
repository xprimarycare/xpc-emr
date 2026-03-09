import { isLocalBackend } from "@/lib/emr-backend";

/**
 * Returns the Prisma field name to use for patient identification
 * in the auth DB, depending on the active EMR backend.
 */
export function getPatientIdField(): "patientLocalId" | "patientFhirId" {
  return isLocalBackend() ? "patientLocalId" : "patientFhirId";
}

/**
 * Extracts the patient ID value from an object that may have
 * either a local `id` or a remote `fhirId`.
 */
export function getPatientIdValue(patient: { fhirId?: string; id?: string }): string {
  const value = isLocalBackend() ? patient.id : patient.fhirId;
  if (!value) {
    throw new Error(
      `Missing patient ${isLocalBackend() ? "id" : "fhirId"} for current backend mode`
    );
  }
  return value;
}
