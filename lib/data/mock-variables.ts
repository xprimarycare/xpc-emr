import { Variable, Template } from '../types/variable';

export const mockVariables: Record<string, Variable> = {
  meds: {
    name: 'meds',
    content: `<p><strong>Current Medications</strong></p>
<p>• Prozac 20mg PO daily - Depression</p>
<p>• Adderall XR 30mg PO QAM - ADHD</p>
<p>• Trazodone 50mg PO QHS PRN - Insomnia</p>
<p>• Lamictal 100mg PO BID - Bipolar disorder</p>`,
    isPinned: true,
    icon: '💊'
  },
  careteam: {
    name: 'careteam',
    content: `<p><strong>Care Team</strong></p>
<p>• Dr. Sarah Johnson - Primary Care</p>
<p>• Dr. Michael Chen - Psychiatry</p>
<p>• Dr. Emily Rodriguez - Neurology</p>
<p>• Maria Garcia, LCSW - Therapy</p>`,
    isPinned: true,
    icon: '👥'
  },
  allergies: {
    name: 'allergies',
    content: `<p><strong>Allergies</strong></p>
<p>• Penicillin - Rash</p>
<p>• Sulfa drugs - Hives</p>
<p>• NKDA (No Known Drug Allergies) - Updated 2025-12-01</p>`,
    isPinned: false,
    icon: '⚠️'
  },
  vitals: {
    name: 'vitals',
    content: `<p><strong>Vitals (Last Visit)</strong></p>
<p>• BP: 128/82 mmHg</p>
<p>• HR: 72 bpm</p>
<p>• Temp: 98.6°F</p>
<p>• Weight: 180 lbs</p>
<p>• Height: 5'10"</p>
<p>• BMI: 25.8</p>`,
    isPinned: false,
    icon: '📊'
  },
  pmh: {
    name: 'pmh',
    content: `<p><strong>Past Medical History</strong></p>
<p>• ADHD - diagnosed 2005</p>
<p>• Bipolar Disorder Type II - diagnosed 2018</p>
<p>• Chronic Insomnia - ongoing</p>
<p>• Migraine headaches - episodic</p>`,
    isPinned: false,
    icon: '📋'
  }
};

export const mockTemplates: Record<string, Template> = {
  soap: {
    name: 'soap',
    content: `<p><strong>Subjective:</strong></p>
<p>[Patient's chief complaint and history]</p>
<br>
<p><strong>Objective:</strong></p>
<p>[Physical exam findings, vitals, labs]</p>
<br>
<p><strong>Assessment:</strong></p>
<p>[Diagnosis and clinical impression]</p>
<br>
<p><strong>Plan:</strong></p>
<p>[Treatment plan and follow-up]</p>`,
    isPinned: true,
    icon: '📝'
  },
  followup: {
    name: 'followup',
    content: `<p><strong>Follow-up Visit</strong></p>
<p>Patient returns for follow-up of [condition].</p>
<br>
<p><strong>Interval History:</strong></p>
<p>[Changes since last visit]</p>
<br>
<p><strong>Current Status:</strong></p>
<p>[Symptoms, medication adherence, side effects]</p>
<br>
<p><strong>Plan:</strong></p>
<p>• Continue current medications</p>
<p>• Follow up in [timeframe]</p>`,
    isPinned: true,
    icon: '🔄'
  },
  physicalExam: {
    name: 'physicalExam',
    content: `<p><strong>Physical Examination</strong></p>
<p><strong>General:</strong> Alert, oriented, no acute distress</p>
<p><strong>HEENT:</strong> Normocephalic, atraumatic</p>
<p><strong>CV:</strong> RRR, no murmurs</p>
<p><strong>Pulm:</strong> Clear to auscultation bilaterally</p>
<p><strong>Abd:</strong> Soft, non-tender, non-distended</p>
<p><strong>Neuro:</strong> Cranial nerves II-XII intact</p>`,
    isPinned: false,
    icon: '🩺'
  }
};
