// Domain Models for XPC-EMR

export interface Patient {
  id: string;
  name: string;
  mrn: string; // Medical Record Number
  dob: string; // Date of birth (ISO format)
  sex: 'Male' | 'Female' | 'Other' | '';
  avatar: string; // Initials for avatar
}

export interface Tab {
  id: string;
  name: string;
  content: string; // HTML content
  parentId: string | null; // For hierarchical tabs
  isSubtab: boolean;
  expanded: boolean; // If has children, are they shown?
  starred: boolean;
  isVisit: boolean; // Encounter/visit page
  isTask: boolean; // Task page
  visitDate: string | null; // ISO date string
  autoTitle?: boolean; // Auto-update title from content
}

export interface Variable {
  content: string;
  isPinned?: boolean;
}

export interface Variables {
  [key: string]: string | Variable;
}

export interface Template {
  content: string;
  isPinned?: boolean;
}

export interface Templates {
  [key: string]: string | Template;
}

export interface PatientData {
  tabs: Tab[];
  summary: string; // Patient one-liner
  variables: Variables;
}

// Order/Command types
export type OrderType = 'labs' | 'referral' | 'rx' | 'schedule' | 'other';

export interface Order {
  id: string;
  text: string;
  type: OrderType;
  createdAt: string;
}

// AI Message types
export interface AIMessage {
  id: string;
  type: 'query' | 'response';
  content: string;
  timestamp: string;
}
