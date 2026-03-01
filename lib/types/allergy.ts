export interface AppAllergy {
  /** App-level ID for React keys/state management */
  id: string;
  /** Original FHIR resource ID for write-back */
  fhirId: string;
  /** Allergen name (from code.text or code.coding[0].display) */
  substance: string;
  /** Clinical status extracted from CodeableConcept coding */
  clinicalStatus: "active" | "inactive" | "resolved";
  /** Verification status extracted from CodeableConcept coding */
  verificationStatus: "unconfirmed" | "presumed" | "confirmed" | "refuted";
  /** Allergy vs intolerance */
  type: "allergy" | "intolerance" | "";
  /** Primary category */
  category: "food" | "medication" | "environment" | "biologic" | "";
  /** Criticality level */
  criticality: "low" | "high" | "unable-to-assess" | "";
  /** First reaction manifestation display text */
  reaction: string;
  /** Severity of first reaction */
  severity: "mild" | "moderate" | "severe" | "";
  /** When recorded (ISO date) */
  recordedDate?: string;
  /** Code system coding for the allergen */
  coding?: {
    system: string;
    code: string;
    display: string;
  };
  /** Free-text note */
  note?: string;
}
