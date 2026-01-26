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
  soap_note: {
    name: 'soap_note',
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
  follow_up: {
    name: 'follow_up',
    content: `<p><strong>Follow-up Visit</strong></p>
<p><strong>Chief Complaint:</strong> [Reason for visit]</p>
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
    isPinned: false,
    icon: '🔄'
  },
  hpi: {
    name: 'hpi',
    content: `<p><strong>History of Present Illness</strong></p>
<p><strong>Location:</strong> [Where is the symptom?]</p>
<p><strong>Quality:</strong> [What does it feel like?]</p>
<p><strong>Severity:</strong> [Scale of 1-10]</p>
<p><strong>Duration:</strong> [How long?]</p>
<p><strong>Onset:</strong> [When did it start?]</p>
<p><strong>Modifying factors:</strong> [What makes it better/worse?]</p>
<p><strong>Associated symptoms:</strong> [Other symptoms]</p>`,
    isPinned: false,
    icon: '📋'
  }
};
