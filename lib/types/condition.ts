export interface AppCondition {
  /** App-level ID for React keys/state management */
  id: string;
  /** Original FHIR resource ID for write-back */
  fhirId: string;
  /** Condition name (from code.text or code.coding[0].display) */
  name: string;
  /** Clinical status */
  clinicalStatus: "active" | "recurrence" | "relapse" | "inactive" | "remission" | "resolved";
  /** Verification status */
  verificationStatus: "unconfirmed" | "provisional" | "differential" | "confirmed" | "refuted" | "entered-in-error";
  /** Severity (from severity.text or severity.coding[0].display) */
  severity: string;
  /** When condition began (from onset[x]) */
  onsetDate: string;
  /** When condition resolved (from abatement[x]) */
  abatementDate: string;
  /** When entered in system */
  recordedDate?: string;
  /** Body site */
  bodySite: string;
  /** Free-text note */
  note?: string;
  /** Code system coding for the condition (for write-back) */
  coding?: {
    system: string;
    code: string;
    display: string;
  };
}
