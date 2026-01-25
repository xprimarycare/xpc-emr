'use client';

import React from 'react';
import { PatientSummaryHeader } from '../editor/PatientSummaryHeader';
import { RichTextEditor } from '../editor/RichTextEditor';
import { PatientInfoTab } from '../patient/PatientInfoTab';
import { usePatient } from '@/lib/context/PatientContext';
import { useEditor } from '@/lib/context/EditorContext';

export function EditorContainer() {
  const { activePatient } = usePatient();
  const { activeTabId } = useEditor();

  // Find the active tab
  const activeTab = activePatient?.tabs.find(t => t.id === activeTabId);

  // Show patient info form for "Patient Info" tab
  const isPatientInfoTab = activeTab?.name === 'Patient Info';

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      <PatientSummaryHeader />
      {isPatientInfoTab ? <PatientInfoTab /> : <RichTextEditor />}
    </div>
  );
}
