import { PatientData } from '../types/patient';
import { mockVariables } from './mock-variables';

export const mockPatients: PatientData[] = [
  {
    id: 'patient-1',
    name: 'John Doe',
    mrn: '12345',
    dob: '1993-01-01',
    sex: 'Male',
    summary: '33 yo male with ADHD, bipolar, and insomnia',
    variables: Object.entries(mockVariables).reduce((acc, [key, val]) => {
      acc[key] = typeof val === 'string' ? val : val.content;
      return acc;
    }, {} as Record<string, string>),
    tabs: [
      // Pages Section
      {
        id: 'tab-1',
        name: 'Summary',
        content: '',
        section: 'pages',
        starred: true
      },
      {
        id: 'tab-2',
        name: 'Patient Info',
        content: '<p><strong>Demographics</strong></p><p>Name: John Doe</p><p>DOB: 01/01/1993 (Age 33)</p><p>Sex: Male</p><p>MRN: 12345</p>',
        section: 'pages'
      },
      {
        id: 'tab-3',
        name: 'Goals of Care',
        content: '',
        section: 'pages'
      },
      {
        id: 'tab-4',
        name: 'Care Team',
        content: mockVariables.careteam.content,
        section: 'pages'
      },
      {
        id: 'tab-5',
        name: 'Medications',
        content: mockVariables.meds.content,
        section: 'pages'
      },
      {
        id: 'tab-6',
        name: 'Allergies',
        content: mockVariables.allergies.content,
        section: 'pages'
      },
      {
        id: 'tab-7',
        name: 'Medical History',
        content: mockVariables.pmh.content,
        section: 'pages'
      },
      {
        id: 'tab-8',
        name: 'Surgical History',
        content: '<p><strong>Surgical History</strong></p><p>No prior surgeries</p>',
        section: 'pages'
      },
      {
        id: 'tab-9',
        name: 'Family History',
        content: '<p><strong>Family History</strong></p><p>• Father: Type 2 Diabetes, HTN</p><p>• Mother: Depression, Hypothyroidism</p><p>• Siblings: Sister with anxiety disorder</p>',
        section: 'pages'
      },
      {
        id: 'tab-10',
        name: 'Social History',
        content: '<p><strong>Social History</strong></p><p>• Occupation: Software Engineer</p><p>• Smoking: Never smoker</p><p>• Alcohol: Occasional (1-2 drinks/week)</p><p>• Exercise: 3x/week cardio</p>',
        section: 'pages'
      },
      {
        id: 'tab-11',
        name: 'Preventive Care',
        content: '',
        section: 'pages'
      },
      {
        id: 'tab-12',
        name: 'Diagnostics',
        content: '<p><strong>Labs & Imaging</strong></p><p>CBC - 2025-11-15: WNL</p><p>CMP - 2025-11-15: WNL</p><p>TSH - 2025-11-15: 2.4 mIU/L</p>',
        section: 'pages'
      },
      // Encounters Section
      {
        id: 'tab-13',
        name: 'Follow-up Visit',
        content: '<p><strong>Date:</strong> 2025-12-31</p><p><strong>Chief Complaint:</strong> Medication refill and routine follow-up</p><p><strong>HPI:</strong> Patient doing well on current medication regimen. Reports improved mood stability and focus. Sleep improved with trazodone PRN.</p>',
        section: 'encounters',
        isVisit: true,
        visitDate: '2025-12-31',
        starred: true
      },
      {
        id: 'tab-14',
        name: 'Initial Consult',
        content: '<p><strong>Date:</strong> 2025-11-30</p><p><strong>Chief Complaint:</strong> Initial psychiatric evaluation</p><p><strong>HPI:</strong> 33 yo male presents for initial psychiatric evaluation. Long-standing history of ADHD and bipolar disorder. Currently on multiple psychiatric medications.</p>',
        section: 'encounters',
        isVisit: true,
        visitDate: '2025-11-30'
      },
      // Tasks Section
      {
        id: 'tab-15',
        name: 'Order Lab Work',
        content: '<p>Order CBC, CMP, TSH for annual physical</p>',
        section: 'tasks',
        isTask: true
      },
      {
        id: 'tab-16',
        name: 'Prior Auth for Medication',
        content: '<p>Submit prior authorization for Adderall XR</p>',
        section: 'tasks',
        isTask: true
      }
    ]
  },
  {
    id: 'patient-2',
    name: 'Jane Smith',
    mrn: '67890',
    dob: '1985-05-15',
    sex: 'Female',
    summary: '40 yo female with hypertension and diabetes',
    tabs: [
      {
        id: 'tab-p2-1',
        name: 'Summary',
        content: '<p>Jane Smith - 40 yo female with HTN and T2DM</p>',
        section: 'pages',
        starred: true
      },
      {
        id: 'tab-p2-2',
        name: 'Patient Info',
        content: '<p><strong>Demographics</strong></p><p>Name: Jane Smith</p><p>DOB: 05/15/1985 (Age 40)</p><p>Sex: Female</p><p>MRN: 67890</p>',
        section: 'pages'
      },
      {
        id: 'tab-p2-3',
        name: 'Problems',
        content: '<p><strong>Active Problems</strong></p><p>1. Hypertension (I10)</p><p>2. Type 2 Diabetes Mellitus (E11.9)</p>',
        section: 'pages'
      }
    ]
  }
];

export const getPatientById = (id: string): PatientData | undefined => {
  return mockPatients.find(p => p.id === id);
};
