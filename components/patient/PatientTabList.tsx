'use client';

import React from 'react';
import { PatientTab } from './PatientTab';
import { usePatient } from '@/lib/context/PatientContext';

export function PatientTabList() {
  const { patients, activePatientId, setActivePatientId, removePatient } = usePatient();

  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {patients.map(patient => (
        <PatientTab
          key={patient.id}
          patient={patient}
          isActive={patient.id === activePatientId}
          onClick={() => setActivePatientId(patient.id)}
          onClose={patients.length > 1 ? () => removePatient(patient.id) : undefined}
        />
      ))}
    </div>
  );
}
