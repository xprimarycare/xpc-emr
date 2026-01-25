export interface Patient {
  id: string;
  name: string;
  mrn: string;
  dob: string;
  sex: string;
  avatar?: string;
  summary?: string;
  variables?: Record<string, string>;
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
}
