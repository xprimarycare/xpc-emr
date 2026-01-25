'use client';

import React from 'react';
import { PatientTab } from './PatientTab';
import { usePatient } from '@/lib/context/PatientContext';
import { useEditor } from '@/lib/context/EditorContext';

export function PatientTabList() {
  const { patients, activePatientId, setActivePatientId, removePatient } = usePatient();
  const { setActiveTabId } = useEditor();

  const handlePatientSwitch = (patientId: string) => {
    setActivePatientId(patientId);
    // Switch to the first tab of the new patient
    const patient = patients.find(p => p.id === patientId);
    if (patient && patient.tabs.length > 0) {
      setActiveTabId(patient.tabs[0].id);
    }
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {patients.map(patient => (
        <PatientTab
          key={patient.id}
          patient={patient}
          isActive={patient.id === activePatientId}
          onClick={() => handlePatientSwitch(patient.id)}
          onClose={patients.length > 1 ? () => removePatient(patient.id) : undefined}
        />
      ))}
    </div>
  );
}
