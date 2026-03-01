'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePatient } from '@/lib/context/PatientContext';
import { AppSocialHistoryObservation } from '@/lib/types/social-history';
import {
  searchFhirSocialHistories,
  upsertFhirSocialHistory,
  deleteFhirSocialHistory,
  createFhirSocialHistory,
  classifySocialHistoryEntries,
  ClassifiedSocialHistoryEntry,
} from '@/lib/services/fhir-social-history-service';

type SaveStatus = 'idle' | 'loading' | 'saving' | 'success' | 'error';
type SyncStatus = 'idle' | 'resolving' | 'preview' | 'syncing' | 'success' | 'error';

export function SocialHistoryTab() {
  const { activePatient } = usePatient();
  const isFhirPatient = !!activePatient?.fhirId;
  const editorRef = useRef<HTMLDivElement>(null);

  const [observations, setObservations] = useState<AppSocialHistoryObservation[]>([]);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AppSocialHistoryObservation>>({});

  // Sync state
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [classifiedEntries, setClassifiedEntries] = useState<ClassifiedSocialHistoryEntry[]>([]);

  // Fetch social history when FHIR patient changes
  useEffect(() => {
    if (!isFhirPatient || !activePatient?.fhirId) {
      setObservations([]);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setError(null);
    searchFhirSocialHistories(activePatient.fhirId).then((result) => {
      if (cancelled) return;
      if (result.error) {
        setError(result.error);
        setStatus('error');
      } else {
        setObservations(result.observations);
        setError(null);
        setStatus('idle');
      }
    });
    return () => { cancelled = true; };
  }, [activePatient?.fhirId, isFhirPatient]);

  const handleEdit = (obs: AppSocialHistoryObservation) => {
    setEditingId(obs.id);
    setEditForm({ ...obs });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async (obs: AppSocialHistoryObservation) => {
    if (!activePatient?.fhirId) return;

    const updated = { ...obs, ...editForm } as AppSocialHistoryObservation;
    const previousObservations = observations;

    setObservations((prev) =>
      prev.map((o) => (o.id === obs.id ? updated : o))
    );
    setEditingId(null);
    setEditForm({});

    setStatus('saving');
    setError(null);
    const result = await upsertFhirSocialHistory(updated, activePatient.fhirId);
    if (result.success) {
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } else {
      setObservations(previousObservations);
      setError(result.error || 'Failed to save');
      setStatus('error');
    }
  };

  const handleDelete = async (obs: AppSocialHistoryObservation) => {
    if (!obs.fhirId) return;

    const previousObservations = observations;
    setObservations((prev) => prev.filter((o) => o.id !== obs.id));
    setEditingId(null);
    setEditForm({});

    setStatus('saving');
    setError(null);
    const result = await deleteFhirSocialHistory(obs.fhirId);
    if (result.success) {
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } else {
      setObservations(previousObservations);
      setError(result.error || 'Failed to delete');
      setStatus('error');
    }
  };

  // Step 1: Classify entries and show preview
  const handleClassify = async () => {
    if (!activePatient?.fhirId) return;

    const text = editorRef.current?.innerText || '';
    if (!text.trim()) {
      setSyncError('Type some social history entries before syncing.');
      setSyncStatus('error');
      return;
    }

    setSyncStatus('resolving');
    setSyncError(null);
    setClassifiedEntries([]);

    const result = await classifySocialHistoryEntries(text);
    if (result.entries.length === 0) {
      setSyncError(result.error || 'No social history entries could be parsed from the text.');
      setSyncStatus('error');
      return;
    }

    setClassifiedEntries(result.entries);
    setSyncStatus('preview');
  };

  // Step 2: Create observations from classified entries
  const handleConfirmSync = async () => {
    if (!activePatient?.fhirId || classifiedEntries.length === 0) return;

    setSyncStatus('syncing');
    let allSuccess = true;

    for (const entry of classifiedEntries) {
      const newObs: AppSocialHistoryObservation = {
        id: `new-${Date.now()}-${Math.random()}`,
        fhirId: '',
        name: entry.category?.display || entry.displayValue,
        status: 'final',
        value: entry.displayValue,
        effectiveDate: '',
        coding: entry.category
          ? {
              system: entry.category.system,
              code: entry.category.code,
              display: entry.category.display,
            }
          : undefined,
      };

      const result = await createFhirSocialHistory(newObs, activePatient.fhirId);
      if (!result.success) {
        setSyncError(result.error || `Failed to create observation: ${entry.originalText}`);
        allSuccess = false;
        break;
      }
    }

    if (allSuccess) {
      if (editorRef.current) {
        editorRef.current.textContent = '';
      }
      setClassifiedEntries([]);
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 2000);

      const refreshed = await searchFhirSocialHistories(activePatient.fhirId);
      if (!refreshed.error) {
        setObservations(refreshed.observations);
      }
    } else {
      setSyncStatus('error');
    }
  };

  const handleCancelPreview = () => {
    setClassifiedEntries([]);
    setSyncStatus('idle');
  };

  if (!activePatient) return null;

  return (
    <div className="py-8 px-8">
      <div className="flex flex-col items-center gap-6">

        {/* Structured Observations Card */}
        <div className="bg-white rounded-lg shadow-sm border p-8 w-full max-w-xl">
          <h2 className="text-xl font-semibold mb-6">Social History</h2>

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
              Loading social history...
            </div>
          )}

          {/* Empty state */}
          {status !== 'loading' && observations.length === 0 && status !== 'error' && (
            <div className="text-gray-400 text-sm text-center py-8">
              No social history observations found in Medplum
            </div>
          )}

          {/* Observations list */}
          {observations.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 mb-2">
                {observations.length} observation{observations.length !== 1 ? 's' : ''} from Medplum
              </p>
              {observations.map((obs) => (
                <div
                  key={obs.id}
                  className="p-4 border border-gray-200 rounded-lg"
                >
                  {editingId === obs.id ? (
                    /* Edit mode */
                    <div className="space-y-3">
                      <input
                        className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={editForm.value || ''}
                        onChange={(e) => setEditForm({ ...editForm, value: e.target.value, name: e.target.value })}
                        placeholder="e.g. Never smoker, Social drinker, Retired teacher"
                      />
                      {obs.coding?.code && (
                        <p className="text-xs text-gray-500">
                          LOINC: {obs.coding.code}{obs.coding.display ? ` — ${obs.coding.display}` : ''}
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          type="date"
                          value={editForm.effectiveDate || ''}
                          onChange={(e) => setEditForm({ ...editForm, effectiveDate: e.target.value })}
                        />
                        <input
                          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={editForm.note || ''}
                          onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                          placeholder="Note (optional)"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSave(obs)}
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
                          onClick={() => handleDelete(obs)}
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
                      onClick={() => handleEdit(obs)}
                    >
                      <div>
                        <p className="font-medium text-sm text-gray-900">
                          {obs.coding?.display
                            ? <>{obs.coding.display} <span className="text-gray-400 font-normal">&mdash;</span> {obs.value}</>
                            : obs.value || obs.name}
                        </p>
                        {obs.coding?.code && (
                          <p className="text-xs text-gray-400 mt-1">
                            LOINC {obs.coding.code}
                          </p>
                        )}
                        {obs.effectiveDate && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(obs.effectiveDate).toLocaleDateString()}
                          </p>
                        )}
                        {obs.note && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{obs.note}</p>
                        )}
                      </div>
                      <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {isFhirPatient && status === 'idle' && observations.length > 0 && (
            <p className="text-xs text-gray-400 text-center mt-4">
              Click an observation to edit · Changes will be saved to Medplum
            </p>
          )}
        </div>

        {/* Add Social History Card (free-text sync area) */}
        {isFhirPatient && (
          <div className="bg-white rounded-lg shadow-sm border p-8 w-full max-w-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Add Social History</h2>
              <button
                onClick={handleClassify}
                disabled={syncStatus === 'resolving' || syncStatus === 'syncing' || syncStatus === 'preview'}
                className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {syncStatus === 'resolving'
                  ? 'Classifying...'
                  : syncStatus === 'syncing'
                    ? 'Creating...'
                    : syncStatus === 'preview'
                      ? 'Review below'
                      : 'Sync to Medplum'}
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
                Social history synced to Medplum
              </div>
            )}

            {syncStatus === 'resolving' && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
                Classifying entries...
              </div>
            )}

            {syncStatus === 'syncing' && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
                Creating observations in Medplum...
              </div>
            )}

            {/* Classification preview */}
            {syncStatus === 'preview' && classifiedEntries.length > 0 && (
              <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-md">
                <p className="text-xs text-gray-500 mb-3 font-medium">
                  Classified entries ({classifiedEntries.length}):
                </p>
                <div className="space-y-2">
                  {classifiedEntries.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {entry.category ? (
                        <>
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium whitespace-nowrap">
                            {entry.category.display}
                          </span>
                          <span className="text-gray-400">&mdash;</span>
                          <span className="text-gray-800">{entry.displayValue}</span>
                          <span className="text-gray-300 ml-auto whitespace-nowrap">
                            LOINC {entry.category.code}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 font-medium whitespace-nowrap">
                            Unclassified
                          </span>
                          <span className="text-gray-400">&mdash;</span>
                          <span className="text-gray-800">{entry.displayValue}</span>
                          <span className="text-orange-400 ml-auto text-[10px] whitespace-nowrap">
                            free text only
                          </span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-4 pt-3 border-t border-gray-200">
                  <button
                    onClick={handleConfirmSync}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    Confirm & Create
                  </button>
                  <button
                    onClick={handleCancelPreview}
                    className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded text-sm hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
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
              data-placeholder="Type social history entries here (e.g. never smoker, social drinker, retired teacher) then click Sync..."
            />
            <p className="text-xs text-gray-400 mt-2">
              Separate entries with commas, newlines, or &quot;and&quot; · Common abbreviations are expanded automatically
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
