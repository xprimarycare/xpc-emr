'use client';

import React, { useState, useEffect } from 'react';
import { usePatient } from '@/lib/context/PatientContext';
import { AppMedication } from '@/lib/types/medication';
import {
  searchFhirMedications,
  upsertFhirMedication,
} from '@/lib/services/fhir-medication-service';

type SaveStatus = 'idle' | 'loading' | 'saving' | 'success' | 'error';

export function MedicationsTab() {
  const { activePatient } = usePatient();
  const isFhirPatient = !!activePatient?.fhirId;

  const [medications, setMedications] = useState<AppMedication[]>([]);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AppMedication>>({});

  // Fetch medications when FHIR patient changes
  useEffect(() => {
    if (!isFhirPatient || !activePatient?.fhirId) {
      setMedications([]);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setError(null);
    searchFhirMedications(activePatient.fhirId).then((result) => {
      if (cancelled) return;
      if (result.error) {
        setError(result.error);
        setStatus('error');
      } else {
        setMedications(result.medications);
        setError(null);
        setStatus('idle');
      }
    });
    return () => { cancelled = true; };
  }, [activePatient?.fhirId, isFhirPatient]);

  const handleEdit = (med: AppMedication) => {
    setEditingId(med.id);
    setEditForm({ ...med });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async (med: AppMedication) => {
    if (!activePatient?.fhirId) return;

    const updated = { ...med, ...editForm } as AppMedication;
    const previousMedications = medications;

    // Update local state immediately
    setMedications((prev) =>
      prev.map((m) => (m.id === med.id ? updated : m))
    );
    setEditingId(null);
    setEditForm({});

    // Write to Medplum
    setStatus('saving');
    setError(null);
    const result = await upsertFhirMedication(updated, activePatient.fhirId);
    if (result.success) {
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } else {
      setMedications(previousMedications);
      setError(result.error || 'Failed to save');
      setStatus('error');
    }
  };

  if (!activePatient) return null;

  return (
    <div className="py-8 px-8">
      <div className="bg-white rounded-lg shadow-sm border p-8 w-full max-w-xl mx-auto">
          <h2 className="text-xl font-semibold mb-6">Medications</h2>

          {/* Status banners */}
          {status === 'error' && error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={() => { setError(null); setStatus('idle'); }}
                className="ml-2 text-red-500 hover:text-red-700 text-xs font-medium"
              >
                Dismiss
              </button>
            </div>
          )}

          {status === 'success' && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
              Saved to Medplum
            </div>
          )}

          {status === 'saving' && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
              Saving to Medplum...
            </div>
          )}

          {/* Loading state */}
          {status === 'loading' && (
            <div className="text-gray-400 text-sm text-center py-8">
              Loading medications...
            </div>
          )}

          {/* Empty state */}
          {status !== 'loading' && medications.length === 0 && status !== 'error' && (
            <div className="text-gray-400 text-sm text-center py-8">
              No medications found in Medplum
            </div>
          )}

          {/* Medications list */}
          {medications.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 mb-2">
                {medications.length} medication{medications.length !== 1 ? 's' : ''} from Medplum
              </p>
              {medications.map((med) => (
                <div
                  key={med.id}
                  className="p-4 border border-gray-200 rounded-lg"
                >
                  {editingId === med.id ? (
                    /* Edit mode */
                    <div className="space-y-3">
                      <input
                        className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={editForm.name || ''}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        placeholder="Medication name"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={editForm.dose || ''}
                          onChange={(e) => setEditForm({ ...editForm, dose: e.target.value })}
                          placeholder="Dose"
                        />
                        <input
                          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={editForm.route || ''}
                          onChange={(e) => setEditForm({ ...editForm, route: e.target.value })}
                          placeholder="Route"
                        />
                        <input
                          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={editForm.frequency || ''}
                          onChange={(e) => setEditForm({ ...editForm, frequency: e.target.value })}
                          placeholder="Frequency"
                        />
                      </div>
                      <select
                        className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        value={editForm.status || med.status}
                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value as AppMedication['status'] })}
                      >
                        <option value="active">Active</option>
                        <option value="draft">Draft</option>
                        <option value="stopped">Stopped</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="completed">Completed</option>
                        <option value="on-hold">On Hold</option>
                      </select>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSave(med)}
                          disabled={status === 'saving'}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {status === 'saving' ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={handleCancel}
                          className="px-4 py-2 bg-gray-100 text-gray-600 rounded-md text-sm hover:bg-gray-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Display mode */
                    <div
                      className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -m-4 p-4 rounded-lg"
                      onClick={() => handleEdit(med)}
                    >
                      <div>
                        <p className="font-medium text-sm text-gray-900">{med.name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {[med.dose, med.route, med.frequency].filter(Boolean).join(' · ')}
                        </p>
                        {med.dosageText && (
                          <p className="text-xs text-gray-400 mt-0.5">{med.dosageText}</p>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        med.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {med.status}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {isFhirPatient && status === 'idle' && (
            <p className="text-xs text-gray-400 text-center mt-4">
              Changes will be saved to Medplum
            </p>
          )}
      </div>
    </div>
  );
}
