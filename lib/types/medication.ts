export interface AppMedication {
  /** App-level ID for React keys/state management */
  id: string;
  /** Original FHIR resource ID for write-back */
  fhirId: string;
  /** Drug name (from medicationCodeableConcept.text or coding[0].display) */
  name: string;
  /** Dosage amount (e.g., "400mg") */
  dose: string;
  /** Route (e.g., "Oral") */
  route: string;
  /** Frequency (e.g., "BID", "twice daily") */
  frequency: string;
  /** Medication status */
  status: "active" | "cancelled" | "completed" | "stopped" | "draft" | "on-hold";
  /** When prescribed (ISO date) */
  authoredOn?: string;
  /** Free-text dosage instruction */
  dosageText?: string;
  /** RxNorm or other coding */
  coding?: {
    system: string;
    code: string;
    display: string;
  };
  /** Any notes */
  note?: string;
}
