// Repository Interface - Contract for data persistence
import type { Patient, Tab, Variables, Templates } from '@/lib/types';

export interface IEMRRepository {
  // Patient operations
  getPatients(): Promise<Patient[]>;
  getPatient(id: string): Promise<Patient | null>;
  savePatient(patient: Patient): Promise<void>;
  deletePatient(id: string): Promise<void>;

  // Tab/Document operations (per patient)
  getTabs(patientId: string): Promise<Tab[]>;
  saveTabs(patientId: string, tabs: Tab[]): Promise<void>;
  saveTab(patientId: string, tab: Tab): Promise<void>;
  deleteTab(patientId: string, tabId: string): Promise<void>;

  // Patient summary (per patient)
  getSummary(patientId: string): Promise<string>;
  saveSummary(patientId: string, summary: string): Promise<void>;

  // Variables (per patient)
  getVariables(patientId: string): Promise<Variables>;
  saveVariables(patientId: string, variables: Variables): Promise<void>;

  // Templates (global, shared across patients)
  getTemplates(): Promise<Templates>;
  saveTemplates(templates: Templates): Promise<void>;
}
