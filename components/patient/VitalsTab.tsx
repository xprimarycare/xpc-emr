'use client';

import React, { useState, useEffect } from 'react';
import { usePatient } from '@/lib/context/PatientContext';
import { AppVital } from '@/lib/types/vital';
import { AppEncounter } from '@/lib/types/encounter';
import {
  searchFhirVitals,
  upsertFhirVital,
  createFhirVital,
} from '@/lib/services/fhir-vital-service';
import { searchFhirEncounters } from '@/lib/services/fhir-encounter-service';

type SaveStatus = 'idle' | 'loading' | 'saving' | 'success' | 'error';

/** Predefined vital sign types with LOINC codes */
interface VitalType {
  label: string;
  loincCode: string;
  loincDisplay: string;
  unit: string;
  isBP?: boolean;
}

const VITAL_TYPES: VitalType[] = [
  { label: 'Blood Pressure', loincCode: '85354-9', loincDisplay: 'Blood pressure panel', unit: 'mmHg', isBP: true },
  { label: 'Heart Rate', loincCode: '8867-4', loincDisplay: 'Heart rate', unit: 'bpm' },
  { label: 'Respiratory Rate', loincCode: '9279-1', loincDisplay: 'Respiratory rate', unit: 'breaths/min' },
  { label: 'Temperature', loincCode: '8310-5', loincDisplay: 'Body temperature', unit: '°F' },
  { label: 'Oxygen Saturation', loincCode: '2708-6', loincDisplay: 'Oxygen saturation', unit: '%' },
  { label: 'Weight', loincCode: '29463-7', loincDisplay: 'Body weight', unit: 'kg' },
  { label: 'Height', loincCode: '8302-2', loincDisplay: 'Body height', unit: 'cm' },
  { label: 'BMI', loincCode: '39156-5', loincDisplay: 'Body mass index', unit: 'kg/m2' },
];

/** Format a vital's value for display */
function formatVitalValue(vital: AppVital): string {
  if (vital.systolic !== undefined && vital.diastolic !== undefined) {
    return `${vital.systolic}/${vital.diastolic} mmHg`;
  }
  if (vital.value !== undefined) {
    return `${vital.value}${vital.unit ? ` ${vital.unit}` : ''}`;
  }
  return '—';
}

/** Get a colour class based on vital status */
function getVitalStatusColor(vital: AppVital): string {
  if (vital.status === 'cancelled') return 'bg-gray-100 text-gray-500';
  if (vital.status === 'amended') return 'bg-yellow-100 text-yellow-700';
  return 'bg-green-100 text-green-700';
}

/** Format encounter for dropdown display */
function formatEncounterOption(enc: AppEncounter): string {
  const date = enc.date ? new Date(enc.date).toLocaleDateString() : '';
  return `${enc.classDisplay || enc.classCode}${date ? ` — ${date}` : ''}`;
}

/** Encounter selector dropdown shared between add and edit forms */
function EncounterSelect({
  encounters,
  value,
  onChange,
}: {
  encounters: AppEncounter[];
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">Encounter</label>
      <select
        className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">None</option>
        {encounters.map((enc) => (
          <option key={enc.encounterFhirId} value={enc.encounterFhirId || ''}>
            {formatEncounterOption(enc)}
          </option>
        ))}
      </select>
    </div>
  );
}

export function VitalsTab() {
  const { activePatient } = usePatient();
  const isFhirPatient = !!activePatient?.fhirId;

  const [vitals, setVitals] = useState<AppVital[]>([]);
  const [encounters, setEncounters] = useState<AppEncounter[]>([]);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AppVital>>({});

  // Add-new state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newVitalType, setNewVitalType] = useState(VITAL_TYPES[0]);
  const [newValue, setNewValue] = useState('');
  const [newUnit, setNewUnit] = useState(VITAL_TYPES[0].unit);
  const [newSystolic, setNewSystolic] = useState('');
  const [newDiastolic, setNewDiastolic] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newEncounterFhirId, setNewEncounterFhirId] = useState('');

  // Fetch vitals and encounters in parallel when FHIR patient changes
  useEffect(() => {
    if (!isFhirPatient || !activePatient?.fhirId) {
      setVitals([]);
      setEncounters([]);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setError(null);

    Promise.all([
      searchFhirVitals(activePatient.fhirId),
      searchFhirEncounters(activePatient.fhirId),
    ]).then(([vitalsResult, encountersResult]) => {
      if (cancelled) return;
      if (vitalsResult.error) {
        setError(vitalsResult.error);
        setStatus('error');
      } else {
        setVitals(vitalsResult.vitals);
        setError(null);
        setStatus('idle');
      }
      // Encounters failing shouldn't block vitals display
      if (!encountersResult.error) {
        setEncounters(encountersResult.encounters);
      }
    });
    return () => { cancelled = true; };
  }, [activePatient?.fhirId, isFhirPatient]);

  /** Look up encounter display label by FHIR ID */
  const getEncounterLabel = (encounterFhirId: string): string | null => {
    const enc = encounters.find((e) => e.encounterFhirId === encounterFhirId);
    if (!enc) return null;
    return formatEncounterOption(enc);
  };

  const handleEdit = (vital: AppVital) => {
    setEditingId(vital.id);
    setEditForm({ ...vital });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async (vital: AppVital) => {
    if (!activePatient?.fhirId) return;

    const updated = { ...vital, ...editForm } as AppVital;
    // Normalise empty string to undefined so the mapper omits the field
    if (!updated.encounterFhirId) updated.encounterFhirId = undefined;
    const previousVitals = vitals;

    setVitals((prev) =>
      prev.map((v) => (v.id === vital.id ? updated : v))
    );
    setEditingId(null);
    setEditForm({});

    setStatus('saving');
    setError(null);
    const result = await upsertFhirVital(updated, activePatient.fhirId);
    if (result.success) {
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } else {
      setVitals(previousVitals);
      setError(result.error || 'Failed to save');
      setStatus('error');
    }
  };

  const handleAdd = async () => {
    if (!activePatient?.fhirId) return;

    const isBP = 'isBP' in newVitalType && newVitalType.isBP;

    if (isBP && (!newSystolic || !newDiastolic)) return;
    if (!isBP && !newValue) return;

    const tempId = `new-${Date.now()}`;
    const newVital: AppVital = {
      id: tempId,
      name: newVitalType.label,
      loincCode: newVitalType.loincCode,
      loincDisplay: newVitalType.loincDisplay,
      status: 'final',
      effectiveDateTime: new Date().toISOString(),
      patientFhirId: activePatient.fhirId,
      encounterFhirId: newEncounterFhirId || undefined,
      value: isBP ? undefined : Number(newValue),
      unit: isBP ? 'mmHg' : newUnit,
      systolic: isBP ? Number(newSystolic) : undefined,
      diastolic: isBP ? Number(newDiastolic) : undefined,
      note: newNote || undefined,
    };

    // Optimistic add
    setVitals((prev) => [newVital, ...prev]);
    setShowAddForm(false);
    resetAddForm();

    setStatus('saving');
    setError(null);
    const result = await createFhirVital(newVital, activePatient.fhirId);
    if (result.success) {
      setVitals((prev) =>
        prev.map((v) =>
          v.id === tempId ? { ...v, fhirId: result.fhirId, id: `vital-${result.fhirId}` } : v
        )
      );
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } else {
      setVitals((prev) => prev.filter((v) => v.id !== tempId));
      setError(result.error || 'Failed to create vital');
      setStatus('error');
    }
  };

  const resetAddForm = () => {
    setNewVitalType(VITAL_TYPES[0]);
    setNewValue('');
    setNewUnit(VITAL_TYPES[0].unit);
    setNewSystolic('');
    setNewDiastolic('');
    setNewNote('');
    setNewEncounterFhirId('');
  };

  const handleVitalTypeChange = (loincCode: string) => {
    const vt = VITAL_TYPES.find((t) => t.loincCode === loincCode) || VITAL_TYPES[0];
    setNewVitalType(vt);
    setNewUnit(vt.unit);
  };

  const isBloodPressure = (vital: AppVital) =>
    vital.loincCode === '85354-9';

  const isBPNew = 'isBP' in newVitalType && newVitalType.isBP;

  if (!activePatient) return null;

  return (
    <div className="py-8 px-8">
      <div className="bg-white rounded-lg shadow-sm border p-8 w-full max-w-xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Vitals</h2>
            {isFhirPatient && !showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                + Add Vitals
              </button>
            )}
          </div>

          {/* Add new vital form */}
          {showAddForm && (
            <div className="mb-6 p-4 border border-blue-200 bg-blue-50 rounded-lg space-y-3">
              <p className="font-medium text-sm text-gray-900">New Vital Sign</p>

              <select
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={newVitalType.loincCode}
                onChange={(e) => handleVitalTypeChange(e.target.value)}
              >
                {VITAL_TYPES.map((vt) => (
                  <option key={vt.loincCode} value={vt.loincCode}>
                    {vt.label}
                  </option>
                ))}
              </select>

              {isBPNew ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Systolic</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      value={newSystolic}
                      onChange={(e) => setNewSystolic(e.target.value)}
                      placeholder="120"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Diastolic</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      value={newDiastolic}
                      onChange={(e) => setNewDiastolic(e.target.value)}
                      placeholder="80"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Value</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      placeholder="Value"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Unit</label>
                    <input
                      className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      value={newUnit}
                      onChange={(e) => setNewUnit(e.target.value)}
                      placeholder="Unit"
                    />
                  </div>
                </div>
              )}

              {/* Encounter link */}
              {encounters.length > 0 && (
                <EncounterSelect
                  encounters={encounters}
                  value={newEncounterFhirId}
                  onChange={setNewEncounterFhirId}
                />
              )}

              <input
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Note (optional)"
              />

              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={status === 'saving' || (isBPNew ? (!newSystolic || !newDiastolic) : !newValue)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === 'saving' ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => { setShowAddForm(false); resetAddForm(); }}
                  className="px-4 py-2 bg-gray-100 text-gray-600 rounded-md text-sm hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

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
              Loading vitals...
            </div>
          )}

          {/* Empty state */}
          {status !== 'loading' && vitals.length === 0 && status !== 'error' && (
            <div className="text-gray-400 text-sm text-center py-8">
              No vitals found in Medplum
            </div>
          )}

          {/* Vitals list */}
          {vitals.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 mb-2">
                {vitals.length} vital{vitals.length !== 1 ? 's' : ''} from Medplum
              </p>
              {vitals.map((vital) => (
                <div
                  key={vital.id}
                  className="p-4 border border-gray-200 rounded-lg"
                >
                  {editingId === vital.id ? (
                    /* Edit mode */
                    <div className="space-y-3">
                      <p className="font-medium text-sm text-gray-900">{vital.name}</p>
                      {vital.loincCode && (
                        <p className="text-xs text-gray-500">LOINC: {vital.loincCode} — {vital.loincDisplay}</p>
                      )}

                      {isBloodPressure(vital) ? (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Systolic</label>
                            <input
                              type="number"
                              className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={editForm.systolic ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, systolic: e.target.value ? Number(e.target.value) : undefined })}
                              placeholder="120"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Diastolic</label>
                            <input
                              type="number"
                              className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={editForm.diastolic ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, diastolic: e.target.value ? Number(e.target.value) : undefined })}
                              placeholder="80"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Value</label>
                            <input
                              type="number"
                              className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={editForm.value ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, value: e.target.value ? Number(e.target.value) : undefined })}
                              placeholder="Value"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Unit</label>
                            <input
                              className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={editForm.unit ?? ''}
                              onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                              placeholder="Unit"
                            />
                          </div>
                        </div>
                      )}

                      <select
                        className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        value={editForm.status || vital.status}
                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value as AppVital['status'] })}
                      >
                        <option value="registered">Registered</option>
                        <option value="preliminary">Preliminary</option>
                        <option value="final">Final</option>
                        <option value="amended">Amended</option>
                        <option value="cancelled">Cancelled</option>
                      </select>

                      {/* Encounter link in edit mode */}
                      {encounters.length > 0 && (
                        <EncounterSelect
                          encounters={encounters}
                          value={editForm.encounterFhirId ?? vital.encounterFhirId ?? ''}
                          onChange={(val) => setEditForm({ ...editForm, encounterFhirId: val || undefined })}
                        />
                      )}

                      <input
                        className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={editForm.note ?? vital.note ?? ''}
                        onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                        placeholder="Note"
                      />

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSave(vital)}
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
                      onClick={() => handleEdit(vital)}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm text-gray-900">{vital.name}</p>
                        </div>
                        <p className="text-lg font-semibold text-gray-800 mt-1">
                          {formatVitalValue(vital)}
                        </p>
                        {vital.effectiveDateTime && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(vital.effectiveDateTime).toLocaleString()}
                          </p>
                        )}
                        {vital.encounterFhirId && (
                          <p className="text-xs text-blue-500 mt-0.5">
                            Encounter: {getEncounterLabel(vital.encounterFhirId) || vital.encounterFhirId}
                          </p>
                        )}
                        {vital.note && (
                          <p className="text-xs text-gray-400 mt-0.5">Note: {vital.note}</p>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${getVitalStatusColor(vital)}`}>
                        {vital.status}
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
