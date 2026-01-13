// Sample Patient Data for Demo
import type { Patient, Tab, Variables } from '@/lib/types';

export const SAMPLE_PATIENT: Patient = {
  id: 'patient-1',
  name: 'John Doe',
  mrn: '12345',
  dob: '1993-01-01',
  sex: 'Male',
  avatar: 'JD',
};

export const SAMPLE_TABS: Tab[] = [
  { 
    id: 'tab-1', 
    name: 'Summary', 
    content: '', 
    parentId: null, 
    isSubtab: false, 
    expanded: true, 
    starred: false, 
    isVisit: false, 
    isTask: false, 
    visitDate: null 
  },
  { 
    id: 'tab-2', 
    name: 'Patient Info', 
    content: '', 
    parentId: null, 
    isSubtab: false, 
    expanded: true, 
    starred: false, 
    isVisit: false, 
    isTask: false, 
    visitDate: null 
  },
  { 
    id: 'tab-3', 
    name: 'Goals of Care', 
    content: '', 
    parentId: null, 
    isSubtab: false, 
    expanded: true, 
    starred: false, 
    isVisit: false, 
    isTask: false, 
    visitDate: null 
  },
  { 
    id: 'tab-4', 
    name: 'Care Team', 
    content: '', 
    parentId: null, 
    isSubtab: false, 
    expanded: true, 
    starred: false, 
    isVisit: false, 
    isTask: false, 
    visitDate: null 
  },
  { 
    id: 'tab-5', 
    name: 'Medications', 
    content: '', 
    parentId: null, 
    isSubtab: false, 
    expanded: true, 
    starred: false, 
    isVisit: false, 
    isTask: false, 
    visitDate: null 
  },
  { 
    id: 'tab-6', 
    name: 'Allergies', 
    content: '', 
    parentId: null, 
    isSubtab: false, 
    expanded: true, 
    starred: false, 
    isVisit: false, 
    isTask: false, 
    visitDate: null 
  },
  { 
    id: 'tab-7', 
    name: 'Medical History', 
    content: '', 
    parentId: null, 
    isSubtab: false, 
    expanded: true, 
    starred: false, 
    isVisit: false, 
    isTask: false, 
    visitDate: null 
  },
  { 
    id: 'tab-8', 
    name: 'Surgical History', 
    content: '', 
    parentId: null, 
    isSubtab: false, 
    expanded: true, 
    starred: false, 
    isVisit: false, 
    isTask: false, 
    visitDate: null 
  },
  { 
    id: 'tab-9', 
    name: 'Family History', 
    content: '', 
    parentId: null, 
    isSubtab: false, 
    expanded: true, 
    starred: false, 
    isVisit: false, 
    isTask: false, 
    visitDate: null 
  },
  { 
    id: 'tab-10', 
    name: 'Social History', 
    content: '', 
    parentId: null, 
    isSubtab: false, 
    expanded: true, 
    starred: false, 
    isVisit: false, 
    isTask: false, 
    visitDate: null 
  },
  { 
    id: 'tab-11', 
    name: 'Preventive Care', 
    content: '', 
    parentId: null, 
    isSubtab: false, 
    expanded: true, 
    starred: false, 
    isVisit: false, 
    isTask: false, 
    visitDate: null 
  },
  { 
    id: 'tab-12', 
    name: 'Diagnostics', 
    content: '', 
    parentId: null, 
    isSubtab: false, 
    expanded: true, 
    starred: false, 
    isVisit: false, 
    isTask: false, 
    visitDate: null 
  },
  // Visit pages
  { 
    id: 'tab-13', 
    name: 'Follow-up Visit', 
    content: '<p><strong>CC:</strong> Follow-up for ADHD medication management</p><p>Patient reports improved focus with current Adderall dose. No significant side effects. Sleep has improved since adding melatonin.</p><p>Vitals: BP 118/76, HR 72</p><p>Plan:</p><p>- Continue current medications</p><p>- Add: Melatonin 3mg qhs for insomnia</p><p>- Follow up in 4 weeks</p>', 
    parentId: null, 
    isSubtab: false, 
    expanded: true, 
    starred: false, 
    isVisit: true, 
    isTask: false, 
    visitDate: '2026-01-01' 
  },
  { 
    id: 'tab-14', 
    name: 'Initial Consult', 
    content: '<p><strong>CC:</strong> New patient evaluation for ADHD</p><p>Diagnosis: ADHD, Combined Type. Started Adderall XR 10mg daily.</p>', 
    parentId: null, 
    isSubtab: false, 
    expanded: true, 
    starred: false, 
    isVisit: true, 
    isTask: false, 
    visitDate: '2025-12-01' 
  }
];

export const SAMPLE_SUMMARY = '33 yo male with ADHD, bipolar, and insomnia';

export const SAMPLE_VARIABLES: Variables = {
  'meds': '<p><strong>Current Medications</strong></p><p>• Prozac 20mg qhs for depression</p><p>• Losartan 50mg for hypertension</p>',
  'careteam': '<p><strong>Care Team</strong></p><p>• Tom Great, MD (Virtual PCP)</p><p>• Mary Jane, PA (Psych)</p>',
  'allergies': '<p><strong>Allergies</strong></p><p>• Penicillin (Hives)</p>'
};

// Initialize sample data in localStorage if not present
export async function initializeSampleData() {
  if (typeof window === 'undefined') return;
  
  const { getRepository } = await import('./repositories');
  const repo = getRepository();
  
  // Check if already initialized
  const patients = await repo.getPatients();
  if (patients.length > 0) return;
  
  // Save sample patient
  await repo.savePatient(SAMPLE_PATIENT);
  await repo.saveTabs(SAMPLE_PATIENT.id, SAMPLE_TABS);
  await repo.saveSummary(SAMPLE_PATIENT.id, SAMPLE_SUMMARY);
  await repo.saveVariables(SAMPLE_PATIENT.id, SAMPLE_VARIABLES);
}
