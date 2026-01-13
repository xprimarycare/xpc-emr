// LocalStorage Implementation of EMR Repository
import type { IEMRRepository } from './types';
import type { Patient, Tab, Variables, Templates, PatientData } from '@/lib/types';

const STORAGE_KEYS = {
  PATIENTS: 'xpc_emr_patients',
  PATIENT_DATA: (patientId: string) => `xpc_emr_patient_${patientId}`,
  TEMPLATES: 'xpc_emr_templates',
};

export class LocalStorageRepository implements IEMRRepository {
  // Helper to safely parse JSON from localStorage
  private getItem<T>(key: string, defaultValue: T): T {
    if (typeof window === 'undefined') return defaultValue;
    
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading ${key} from localStorage:`, error);
      return defaultValue;
    }
  }

  // Helper to safely set JSON in localStorage
  private setItem(key: string, value: any): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing ${key} to localStorage:`, error);
    }
  }

  // Patient operations
  async getPatients(): Promise<Patient[]> {
    return this.getItem<Patient[]>(STORAGE_KEYS.PATIENTS, []);
  }

  async getPatient(id: string): Promise<Patient | null> {
    const patients = await this.getPatients();
    return patients.find(p => p.id === id) || null;
  }

  async savePatient(patient: Patient): Promise<void> {
    const patients = await this.getPatients();
    const index = patients.findIndex(p => p.id === patient.id);
    
    if (index >= 0) {
      patients[index] = patient;
    } else {
      patients.push(patient);
    }
    
    this.setItem(STORAGE_KEYS.PATIENTS, patients);
  }

  async deletePatient(id: string): Promise<void> {
    const patients = await this.getPatients();
    const filtered = patients.filter(p => p.id !== id);
    this.setItem(STORAGE_KEYS.PATIENTS, filtered);
    
    // Also remove patient data
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.PATIENT_DATA(id));
    }
  }

  // Helper to get patient data
  private async getPatientData(patientId: string): Promise<PatientData> {
    return this.getItem<PatientData>(STORAGE_KEYS.PATIENT_DATA(patientId), {
      tabs: [],
      summary: '',
      variables: {},
    });
  }

  // Helper to save patient data
  private async savePatientData(patientId: string, data: Partial<PatientData>): Promise<void> {
    const currentData = await this.getPatientData(patientId);
    const updatedData = { ...currentData, ...data };
    this.setItem(STORAGE_KEYS.PATIENT_DATA(patientId), updatedData);
  }

  // Tab operations
  async getTabs(patientId: string): Promise<Tab[]> {
    const data = await this.getPatientData(patientId);
    return data.tabs;
  }

  async saveTabs(patientId: string, tabs: Tab[]): Promise<void> {
    await this.savePatientData(patientId, { tabs });
  }

  async saveTab(patientId: string, tab: Tab): Promise<void> {
    const tabs = await this.getTabs(patientId);
    const index = tabs.findIndex(t => t.id === tab.id);
    
    if (index >= 0) {
      tabs[index] = tab;
    } else {
      tabs.push(tab);
    }
    
    await this.saveTabs(patientId, tabs);
  }

  async deleteTab(patientId: string, tabId: string): Promise<void> {
    const tabs = await this.getTabs(patientId);
    const filtered = tabs.filter(t => t.id !== tabId);
    await this.saveTabs(patientId, filtered);
  }

  // Summary operations
  async getSummary(patientId: string): Promise<string> {
    const data = await this.getPatientData(patientId);
    return data.summary;
  }

  async saveSummary(patientId: string, summary: string): Promise<void> {
    await this.savePatientData(patientId, { summary });
  }

  // Variables operations
  async getVariables(patientId: string): Promise<Variables> {
    const data = await this.getPatientData(patientId);
    return data.variables;
  }

  async saveVariables(patientId: string, variables: Variables): Promise<void> {
    await this.savePatientData(patientId, { variables });
  }

  // Templates operations (global)
  async getTemplates(): Promise<Templates> {
    return this.getItem<Templates>(STORAGE_KEYS.TEMPLATES, {});
  }

  async saveTemplates(templates: Templates): Promise<void> {
    this.setItem(STORAGE_KEYS.TEMPLATES, templates);
  }
}
