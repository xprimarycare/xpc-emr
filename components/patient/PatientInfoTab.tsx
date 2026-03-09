'use client';

import React, { useState, useEffect } from 'react';
import { usePatient } from '@/lib/context/PatientContext';
import { upsertFhirPatient, createFhirPatient } from '@/lib/services/fhir-patient-service';

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

export function PatientInfoTab() {
  const { activePatient, updatePatient } = usePatient();
  const [formData, setFormData] = useState({
    name: '',
    mrn: '',
    dob: '',
    sex: ''
  });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const isFhirPatient = !!activePatient?.fhirId;

  useEffect(() => {
    if (activePatient) {
      setFormData({
        name: activePatient.name || '',
        mrn: activePatient.mrn || '',
        dob: activePatient.dob || '',
        sex: activePatient.sex || ''
      });
      setSaveStatus('idle');
      setErrorMessage('');
    }
  }, [activePatient]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!activePatient) return;

    const updates = {
      name: formData.name,
      mrn: formData.mrn || 'No info',
      dob: formData.dob,
      sex: formData.sex
    };

    // Always update local state
    updatePatient(activePatient.id, updates);

    setSaveStatus('saving');
    setErrorMessage('');

    if (isFhirPatient) {
      // Existing FHIR patient — upsert to EMR
      const result = await upsertFhirPatient({
        ...activePatient,
        ...updates,
      });

      if (result.success) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        setErrorMessage(result.error || 'Unknown error');
      }
    } else {
      // New patient — create in EMR
      const result = await createFhirPatient({
        name: formData.name,
        sex: formData.sex,
        dob: formData.dob,
      });

      if (result.success && result.fhirId) {
        updatePatient(activePatient.id, { fhirId: result.fhirId });
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        setErrorMessage(result.error || 'Failed to create patient in EMR');
      }
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!activePatient) return null;

  return (
    <div className="py-8 px-8">
      <div className="bg-white rounded-lg shadow-sm border p-8 w-full max-w-xl mx-auto">
          <h2 className="text-xl font-semibold mb-6">Patient Information</h2>

          {saveStatus === 'error' && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          {saveStatus === 'success' && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
              {isFhirPatient ? 'Saved' : 'Created'}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Patient Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                MRN
              </label>
              <input
                type="text"
                value={formData.mrn}
                onChange={(e) => handleChange('mrn', e.target.value)}
                placeholder="Medical Record Number"
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Date of Birth
              </label>
              <input
                type="date"
                value={formData.dob}
                onChange={(e) => handleChange('dob', e.target.value)}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Sex
              </label>
              <select
                value={formData.sex}
                onChange={(e) => handleChange('sex', e.target.value)}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Select...</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={saveStatus === 'saving'}
              className="w-full bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saveStatus === 'saving' ? 'Saving...' : 'Save Patient'}
            </button>

            {saveStatus === 'idle' && (
              <p className="text-xs text-muted-foreground text-center">
                {isFhirPatient ? 'Changes will be saved to EMR' : 'Patient will be created in EMR'}
              </p>
            )}
          </form>
      </div>
    </div>
  );
}
