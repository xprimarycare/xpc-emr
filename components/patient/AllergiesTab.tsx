'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePatient } from '@/lib/context/PatientContext';
import { AppAllergy } from '@/lib/types/allergy';
import {
  searchFhirAllergies,
  upsertFhirAllergy,
  deleteFhirAllergy,
  createFhirAllergy,
  batchResolveAllergies,
  ResolvedAllergyEntry,
} from '@/lib/services/fhir-allergy-service';

type SaveStatus = 'idle' | 'loading' | 'saving' | 'success' | 'error';
type SyncStatus = 'idle' | 'resolving' | 'syncing' | 'success' | 'error';

export function AllergiesTab({ refreshKey }: { refreshKey?: number }) {
  const { activePatient } = usePatient();
  const isFhirPatient = !!activePatient?.fhirId;
  const editorRef = useRef<HTMLDivElement>(null);

  const [allergies, setAllergies] = useState<AppAllergy[]>([]);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AppAllergy>>({});

  // Sync state
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [resolvedEntries, setResolvedEntries] = useState<ResolvedAllergyEntry[]>([]);

  // Fetch allergies when FHIR patient changes
  useEffect(() => {
    if (!isFhirPatient || !activePatient?.fhirId) {
      setAllergies([]);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setError(null);
    searchFhirAllergies(activePatient.fhirId).then((result) => {
      if (cancelled) return;
      if (result.error) {
        setError(result.error);
        setStatus('error');
      } else {
        setAllergies(result.allergies);
        setError(null);
        setStatus('idle');
      }
    });
    return () => { cancelled = true; };
  }, [activePatient?.fhirId, isFhirPatient, refreshKey]);

  const handleEdit = (allergy: AppAllergy) => {
    setEditingId(allergy.id);
    setEditForm({ ...allergy });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async (allergy: AppAllergy) => {
    if (!activePatient?.fhirId) return;

    const updated = { ...allergy, ...editForm } as AppAllergy;
    const previousAllergies = allergies;

    setAllergies((prev) =>
      prev.map((a) => (a.id === allergy.id ? updated : a))
    );
    setEditingId(null);
    setEditForm({});

    setStatus('saving');
    setError(null);
    const result = await upsertFhirAllergy(updated, activePatient.fhirId);
    if (result.success) {
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } else {
      setAllergies(previousAllergies);
      setError(result.error || 'Failed to save');
      setStatus('error');
    }
  };

  const handleDelete = async (allergy: AppAllergy) => {
    if (!allergy.fhirId) return;

    const previousAllergies = allergies;
    setAllergies((prev) => prev.filter((a) => a.id !== allergy.id));
    setEditingId(null);
    setEditForm({});

    setStatus('saving');
    setError(null);
    const result = await deleteFhirAllergy(allergy.fhirId);
    if (result.success) {
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } else {
      setAllergies(previousAllergies);
      setError(result.error || 'Failed to delete');
      setStatus('error');
    }
  };

  const handleSync = async () => {
    if (!activePatient?.fhirId) return;

    const text = editorRef.current?.innerText || '';
    if (!text.trim()) {
      setSyncError('Type some allergens before syncing.');
      setSyncStatus('error');
      return;
    }

    // Step 1: Resolve all terms to RxNorm/SNOMED codes
    setSyncStatus('resolving');
    setSyncError(null);
    setResolvedEntries([]);

    const resolved = await batchResolveAllergies(text);
    if (resolved.entries.length === 0) {
      setSyncError(resolved.error || 'No allergens could be parsed from the text.');
      setSyncStatus('error');
      return;
    }

    setResolvedEntries(resolved.entries);

    // Step 2: Create each as an AllergyIntolerance in EMR
    setSyncStatus('syncing');
    let allSuccess = true;

    for (const entry of resolved.entries) {
      const newAllergy: AppAllergy = {
        id: `new-${Date.now()}-${Math.random()}`,
        fhirId: '',
        substance: entry.term.charAt(0).toUpperCase() + entry.term.slice(1),
        clinicalStatus: 'active',
        verificationStatus: 'unconfirmed',
        type: 'allergy',
        category: entry.isMed ? 'medication' : '',
        criticality: '',
        reaction: entry.reaction,
        severity: '',
        coding: entry.code ? {
          system: entry.code.system,
          code: entry.code.code,
          display: entry.code.description,
        } : undefined,
      };

      const result = await createFhirAllergy(newAllergy, activePatient.fhirId);
      if (!result.success) {
        setSyncError(result.error || `Failed to create allergy: ${entry.term}`);
        allSuccess = false;
        break;
      }
    }

    if (allSuccess) {
      if (editorRef.current) {
        editorRef.current.textContent = '';
      }
      setResolvedEntries([]);
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 2000);

      // Re-fetch allergies list from EMR
      const refreshed = await searchFhirAllergies(activePatient.fhirId);
      if (!refreshed.error) {
        setAllergies(refreshed.allergies);
      }
    } else {
      setSyncStatus('error');
    }
  };

  if (!activePatient) return null;

  return (
    <div className="py-8 px-8">
      <div className="flex flex-col items-center gap-6">

        {/* ── Structured Allergies Card ── */}
        <div className="bg-white rounded-lg shadow-sm border p-8 w-full max-w-xl">
          <h2 className="text-xl font-semibold mb-6">Allergies</h2>

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
              Saved
            </div>
          )}

          {status === 'saving' && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
              Saving...
            </div>
          )}

          {/* Loading state */}
          {status === 'loading' && (
            <div className="text-gray-400 text-sm text-center py-8">
              Loading allergies...
            </div>
          )}

          {/* Empty state */}
          {status !== 'loading' && allergies.length === 0 && status !== 'error' && (
            <div className="text-gray-400 text-sm text-center py-8">
              No allergies found in EMR
            </div>
          )}

          {/* Allergies list */}
          {allergies.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 mb-2">
                {allergies.length} allerg{allergies.length !== 1 ? 'ies' : 'y'} from EMR
              </p>
              {allergies.map((allergy) => (
                <div
                  key={allergy.id}
                  className="p-4 border border-gray-200 rounded-lg"
                >
                  {editingId === allergy.id ? (
                    /* Edit mode */
                    <div className="space-y-3">
                      <input
                        className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={editForm.substance || ''}
                        onChange={(e) => setEditForm({ ...editForm, substance: e.target.value })}
                        placeholder="Allergen name"
                      />
                      {allergy.coding?.code && (
                        <p className="text-xs text-gray-500">
                          {allergy.coding.system?.includes('rxnorm') ? 'RxNorm' : 'SNOMED'}: {allergy.coding.code}{allergy.coding.display ? ` — ${allergy.coding.display}` : ''}
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          value={editForm.clinicalStatus || allergy.clinicalStatus}
                          onChange={(e) => setEditForm({ ...editForm, clinicalStatus: e.target.value as AppAllergy['clinicalStatus'] })}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="resolved">Resolved</option>
                        </select>
                        <select
                          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          value={editForm.criticality || allergy.criticality}
                          onChange={(e) => setEditForm({ ...editForm, criticality: e.target.value as AppAllergy['criticality'] })}
                        >
                          <option value="">Criticality...</option>
                          <option value="low">Low</option>
                          <option value="high">High</option>
                          <option value="unable-to-assess">Unable to Assess</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          value={editForm.category || allergy.category}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value as AppAllergy['category'] })}
                        >
                          <option value="">Category...</option>
                          <option value="food">Food</option>
                          <option value="medication">Medication</option>
                          <option value="environment">Environment</option>
                          <option value="biologic">Biologic</option>
                        </select>
                        <select
                          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          value={editForm.severity || allergy.severity}
                          onChange={(e) => setEditForm({ ...editForm, severity: e.target.value as AppAllergy['severity'] })}
                        >
                          <option value="">Severity...</option>
                          <option value="mild">Mild</option>
                          <option value="moderate">Moderate</option>
                          <option value="severe">Severe</option>
                        </select>
                      </div>
                      <input
                        className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={editForm.reaction || ''}
                        onChange={(e) => setEditForm({ ...editForm, reaction: e.target.value })}
                        placeholder="Reaction (e.g., hives, anaphylaxis)"
                      />
                      <input
                        className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={editForm.note || ''}
                        onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                        placeholder="Note"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSave(allergy)}
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
                        <div className="flex-1" />
                        <button
                          onClick={() => handleDelete(allergy)}
                          disabled={status === 'saving'}
                          className="px-4 py-2 bg-red-50 text-red-600 rounded-md text-sm hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Display mode */
                    <div
                      className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -m-4 p-4 rounded-lg"
                      onClick={() => handleEdit(allergy)}
                    >
                      <div>
                        <p className="font-medium text-sm text-gray-900">{allergy.substance}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {[allergy.category, allergy.reaction, allergy.severity].filter(Boolean).join(' · ')}
                        </p>
                        {allergy.criticality && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Criticality: {allergy.criticality}
                          </p>
                        )}
                        {allergy.note && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">Note: {allergy.note}</p>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        allergy.clinicalStatus === 'active'
                          ? 'bg-red-100 text-red-700'
                          : allergy.clinicalStatus === 'resolved'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                      }`}>
                        {allergy.clinicalStatus}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {isFhirPatient && status === 'idle' && allergies.length > 0 && (
            <p className="text-xs text-gray-400 text-center mt-4">
              Click an allergy to edit · Changes will be saved to EMR
            </p>
          )}
        </div>

        {/* ── Add Allergies Card (free-text sync area) ── */}
        {isFhirPatient && (
          <div className="bg-white rounded-lg shadow-sm border p-8 w-full max-w-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Add Allergies</h2>
              <button
                onClick={handleSync}
                disabled={syncStatus === 'resolving' || syncStatus === 'syncing'}
                className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {syncStatus === 'resolving'
                  ? 'Resolving...'
                  : syncStatus === 'syncing'
                    ? 'Syncing...'
                    : 'Sync'}
              </button>
            </div>

            {/* Sync status banners */}
            {syncStatus === 'error' && syncError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 flex items-center justify-between">
                <span>{syncError}</span>
                <button
                  onClick={() => { setSyncError(null); setSyncStatus('idle'); }}
                  className="ml-2 text-red-500 hover:text-red-700 text-xs font-medium"
                >
                  Dismiss
                </button>
              </div>
            )}

            {syncStatus === 'success' && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
                Allergies synced
              </div>
            )}

            {syncStatus === 'resolving' && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
                Resolving allergen codes...
              </div>
            )}

            {syncStatus === 'syncing' && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
                Creating allergies...
              </div>
            )}

            {/* Resolved entries preview */}
            {resolvedEntries.length > 0 && syncStatus !== 'idle' && syncStatus !== 'error' && (
              <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
                <p className="text-xs text-gray-500 mb-2">Resolved allergens:</p>
                <div className="space-y-1">
                  {resolvedEntries.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="text-gray-400">{entry.term}</span>
                      {entry.reaction && (
                        <span className="text-amber-600">[reaction: {entry.reaction}]</span>
                      )}
                      <span className="text-gray-300">&rarr;</span>
                      {entry.code ? (
                        <>
                          <span className="font-mono text-blue-600">{entry.code.code}</span>
                          <span className="text-gray-700">{entry.code.description}</span>
                          <span className="text-gray-300">({entry.isMed ? 'RxNorm' : 'SNOMED'})</span>
                        </>
                      ) : (
                        <span className="text-orange-500">No code match (will use free text)</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Free-text editor */}
            <div
              ref={editorRef}
              contentEditable
              className="min-h-[120px] px-4 py-3 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm"
              style={{ lineHeight: '1.6' }}
              suppressContentEditableWarning
              data-placeholder="Type allergen + reaction (e.g. lisinopril swelling, pcn rash, shellfish hives) then click Sync..."
            />
            <p className="text-xs text-gray-400 mt-2">
              Format: &quot;substance reaction&quot; · Separate with commas, newlines, or &quot;and&quot; · Meds via RxNorm, others via SNOMED
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
