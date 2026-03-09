export interface Patient {
  id: string;
  name: string;
  mrn: string;
  dob: string;
  sex: string;
  avatar?: string;
  summary?: string;
  variables?: Record<string, string>;
  fhirId?: string;
}

export interface PatientData extends Patient {
  tabs: Tab[];
}

export interface Tab {
  id: string;
  name: string;
  content: string;
  parentId?: string;
  isSubtab?: boolean;
  starred?: boolean;
  isVisit?: boolean;
  isTask?: boolean;
  visitDate?: string;
  section?: 'pages' | 'encounters' | 'tasks';
  dividerPosition?: number; // top panel percentage (0-100), default 50
  /** FHIR Encounter resource ID (for encounters synced with EMR) */
  encounterFhirId?: string;
  /** FHIR ClinicalImpression resource ID (for encounter notes synced with EMR) */
  noteFhirId?: string;
  /** FHIR Task resource ID (for tasks synced with EMR) */
  taskFhirId?: string;
  /** Whether the encounter note is signed */
  isSigned?: boolean;
  /** ISO datetime when the note was signed */
  signedAt?: string;
  /** Name of the clinician who signed */
  signedBy?: string;
  /** Database user ID of the clinician who signed */
  signedById?: string;
}
