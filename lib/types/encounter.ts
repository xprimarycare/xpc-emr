export interface AppEncounter {
  /** App-level ID for React keys/state management */
  id: string;
  /** FHIR Encounter resource ID for write-back */
  encounterFhirId?: string;
  /** FHIR ClinicalImpression resource ID for note write-back */
  noteFhirId?: string;
  /** Encounter status */
  status: "planned" | "in-progress" | "finished" | "cancelled";
  /** Encounter class code (AMB, IMP, EMER, VR, HH) */
  classCode: "AMB" | "IMP" | "EMER" | "VR" | "HH";
  /** Encounter class display name */
  classDisplay: string;
  /** Encounter date (ISO date string) */
  date: string;
  /** End date/time (ISO string, optional) */
  endDate?: string;
  /** Free-text encounter note (the clinician's narrative) */
  noteText: string;
  /** Patient FHIR ID this encounter belongs to */
  patientFhirId: string;
  /** Whether the encounter note has been signed */
  isSigned?: boolean;
  /** ISO datetime when the note was signed */
  signedAt?: string;
  /** Name of the clinician who signed */
  signedBy?: string;
  /** Database user ID of the clinician who signed */
  signedById?: string;
}

export const ENCOUNTER_CLASS_OPTIONS: Array<{
  code: AppEncounter["classCode"];
  display: string;
}> = [
  { code: "AMB", display: "Ambulatory" },
  { code: "VR", display: "Virtual" },
  { code: "IMP", display: "Inpatient" },
  { code: "EMER", display: "Emergency" },
  { code: "HH", display: "Home Health" },
];
