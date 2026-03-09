'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';
import { useEditor } from '@/lib/context/EditorContext';
import { usePatient } from '@/lib/context/PatientContext';
import { listFhirPatients } from '@/lib/services/fhir-patient-service';
import { PatientData } from '@/lib/types/patient';

export function PatientListPanel() {
  const { leftPanelMode, toggleLeftPanel } = useEditor();
  const { patients, addPatient, setActivePatientId } = usePatient();
  const [fhirPatients, setFhirPatients] = useState<PatientData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (leftPanelMode !== 'patientList') return;

    setIsLoading(true);
    listFhirPatients().then((result) => {
      if (result.error) {
        setError(result.error);
      } else {
        setFhirPatients(result.patients);
        setError(null);
      }
      setIsLoading(false);
    });
  }, [leftPanelMode]);

  const filteredPatients = useMemo(() => {
    if (!filter.trim()) return fhirPatients;
    const q = filter.toLowerCase();
    return fhirPatients.filter((p) => p.name.toLowerCase().includes(q));
  }, [fhirPatients, filter]);

  if (leftPanelMode !== 'patientList') {
    return null;
  }

  const handleSelectPatient = (patient: PatientData) => {
    const existing = patients.find((p) => p.id === patient.id || (patient.fhirId && p.fhirId === patient.fhirId));
    if (existing) {
      setActivePatientId(existing.id);
    } else {
      addPatient(patient);
    }
    toggleLeftPanel('sidebar');
  };

  const computeAge = (dob: string) => {
    if (!dob) return '';
    return String(new Date().getFullYear() - new Date(dob).getFullYear());
  };

  const computeSexInitial = (sex: string) => {
    if (!sex) return '';
    return sex.charAt(0).toUpperCase();
  };

  return (
    <div className="w-60 border-r bg-white flex flex-col overflow-hidden">
      <div className="px-3 py-3 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter patients..."
            className="pl-7 pr-3 py-1.5 bg-gray-50 border-0 rounded-md text-sm w-full focus:outline-none focus:ring-2 focus:ring-gray-200"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-4 text-center text-sm text-gray-500">Loading patients...</div>
        )}

        {!isLoading && error && (
          <div className="p-3 text-sm text-red-600">{error}</div>
        )}

        {!isLoading && !error && filteredPatients.length === 0 && (
          <div className="p-4 text-center text-sm text-gray-500">
            {filter ? 'No matches' : 'No patients found'}
          </div>
        )}

        {!isLoading && !error && filteredPatients.map((patient) => {
          const age = computeAge(patient.dob);
          const sexInitial = computeSexInitial(patient.sex);
          const isOpen = patients.some((p) => p.id === patient.id || (patient.fhirId && p.fhirId === patient.fhirId));

          return (
            <button
              key={patient.id}
              onClick={() => handleSelectPatient(patient)}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <span className="text-sm font-medium truncate block">{patient.name}</span>
                <span className="text-xs text-gray-500">
                  {[age, sexInitial].filter(Boolean).join(' ')}
                </span>
              </div>
              {isOpen && (
                <span className="text-xs text-blue-600 shrink-0">Open</span>
              )}
            </button>
          );
        })}
      </div>

      {!isLoading && !error && (
        <div className="px-3 py-2 border-t bg-gray-50 text-xs text-gray-400">
          {filteredPatients.length} patient{filteredPatients.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
