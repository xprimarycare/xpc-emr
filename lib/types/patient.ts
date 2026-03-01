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
  /** FHIR Encounter resource ID (for encounters synced with Medplum) */
  encounterFhirId?: string;
  /** FHIR ClinicalImpression resource ID (for encounter notes synced with Medplum) */
  noteFhirId?: string;
  /** FHIR Task resource ID (for tasks synced with Medplum) */
  taskFhirId?: string;
}
