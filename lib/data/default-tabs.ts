import { Tab } from '../types/patient';

function buildPatientInfoContent(patient: {
  name: string;
  mrn: string;
  dob: string;
  sex: string;
}): string {
  return `<p><strong>Demographics</strong></p><p>Name: ${patient.name}</p><p>DOB: ${patient.dob}</p><p>Sex: ${patient.sex}</p><p>MRN: ${patient.mrn}</p>`;
}

export function createDefaultTabs(patient: {
  name: string;
  mrn: string;
  dob: string;
  sex: string;
}): Tab[] {
  const prefix = `tab-${Date.now()}`;

  return [
    {
      id: `${prefix}-2`,
      name: 'Patient Info',
      content: buildPatientInfoContent(patient),
      section: 'pages',
    },
    {
      id: `${prefix}-3`,
      name: 'Goals of Care',
      content: '',
      section: 'pages',
    },
    {
      id: `${prefix}-4`,
      name: 'Care Team',
      content: '',
      section: 'pages',
    },
    {
      id: `${prefix}-5`,
      name: 'Medications',
      content: '',
      section: 'pages',
    },
    {
      id: `${prefix}-6`,
      name: 'Allergies',
      content: '',
      section: 'pages',
    },
    {
      id: `${prefix}-7`,
      name: 'Vitals',
      content: '',
      section: 'pages',
    },
    {
      id: `${prefix}-8`,
      name: 'Labs',
      content: '',
      section: 'pages',
    },
    {
      id: `${prefix}-9`,
      name: 'Imaging',
      content: '',
      section: 'pages',
    },
    {
      id: `${prefix}-14`,
      name: 'Referrals',
      content: '',
      section: 'pages',
    },
    {
      id: `${prefix}-10`,
      name: 'Conditions',
      content: '',
      section: 'pages',
    },
    {
      id: `${prefix}-11`,
      name: 'Surgical History',
      content: '',
      section: 'pages',
    },
    {
      id: `${prefix}-12`,
      name: 'Family History',
      content: '',
      section: 'pages',
    },
    {
      id: `${prefix}-13`,
      name: 'Social History',
      content: '',
      section: 'pages',
    },
  ];
}
