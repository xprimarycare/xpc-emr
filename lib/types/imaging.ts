export interface AppImagingOrder {
  /** App-level ID for React keys/state management */
  id: string;
  /** Original FHIR resource ID for write-back */
  fhirId?: string;
  /** Study name (from ServiceRequest.code.text or coding[0].display) */
  studyName: string;
  /** LOINC code for the imaging study */
  loincCode: string;
  /** LOINC display name */
  loincDisplay: string;
  /** Order status */
  status: "draft" | "active" | "completed" | "revoked";
  /** Order priority */
  priority: "routine" | "urgent" | "asap" | "stat";
  /** When the order was placed (ISO date) */
  authoredOn?: string;
  /** Patient FHIR ID */
  patientFhirId: string;
  /** Any notes / clinical indication */
  note?: string;
}
