'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePatient } from '@/lib/context/PatientContext';
import { AppCondition } from '@/lib/types/condition';
import {
  searchFhirConditions,
  upsertFhirCondition,
  deleteFhirCondition,
  createFhirCondition,
  batchResolveDiagnoses,
  ResolvedConditionEntry,
} from '@/lib/services/fhir-condition-service';

type SaveStatus = 'idle' | 'loading' | 'saving' | 'success' | 'error';
type SyncStatus = 'idle' | 'resolving' | 'syncing' | 'success' | 'error';

export function MedicalHistoryTab() {
  const { activePatient } = usePatient();
  const isFhirPatient = !!activePatient?.fhirId;
  const editorRef = useRef<HTMLDivElement>(null);

  const [conditions, setConditions] = useState<AppCondition[]>([]);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AppCondition>>({});

  // Sync state
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [resolvedEntries, setResolvedEntries] = useState<ResolvedConditionEntry[]>([]);

  // Fetch conditions when FHIR patient changes
  useEffect(() => {
    if (!isFhirPatient || !activePatient?.fhirId) {
      setConditions([]);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setError(null);
    searchFhirConditions(activePatient.fhirId).then((result) => {
      if (cancelled) return;
      if (result.error) {
        setError(result.error);
        setStatus('error');
      } else {
        setConditions(result.conditions);
        setError(null);
        setStatus('idle');
      }
    });
    return () => { cancelled = true; };
  }, [activePatient?.fhirId, isFhirPatient]);

  const handleEdit = (condition: AppCondition) => {
    setEditingId(condition.id);
    setEditForm({ ...condition });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async (condition: AppCondition) => {
    if (!activePatient?.fhirId) return;

    const updated = { ...condition, ...editForm } as AppCondition;
    const previousConditions = conditions;

    setConditions((prev) =>
      prev.map((c) => (c.id === condition.id ? updated : c))
    );
    setEditingId(null);
    setEditForm({});

    setStatus('saving');
    setError(null);
    const result = await upsertFhirCondition(updated, activePatient.fhirId);
    if (result.success) {
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } else {
      setConditions(previousConditions);
      setError(result.error || 'Failed to save');
      setStatus('error');
    }
  };

  const handleDelete = async (condition: AppCondition) => {
    if (!condition.fhirId) return;

    const previousConditions = conditions;
    setConditions((prev) => prev.filter((c) => c.id !== condition.id));
    setEditingId(null);
    setEditForm({});

    setStatus('saving');
    setError(null);
    const result = await deleteFhirCondition(condition.fhirId);
    if (result.success) {
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } else {
      setConditions(previousConditions);
      setError(result.error || 'Failed to delete');
      setStatus('error');
    }
  };

  const handleSyncToMedplum = async () => {
    if (!activePatient?.fhirId) return;

    const text = editorRef.current?.innerText || '';
    if (!text.trim()) {
      setSyncError('Type some conditions before syncing.');
      setSyncStatus('error');
      return;
    }

    // Step 1: Resolve all terms to ICD-10 codes
    setSyncStatus('resolving');
    setSyncError(null);
    setResolvedEntries([]);

    const resolved = await batchResolveDiagnoses(text);
    if (resolved.entries.length === 0) {
      setSyncError(resolved.error || 'No conditions could be parsed from the text.');
      setSyncStatus('error');
      return;
    }

    setResolvedEntries(resolved.entries);

    // Step 2: Create each as a Condition in Medplum
    setSyncStatus('syncing');
    let allSuccess = true;

    for (const entry of resolved.entries) {
      const newCondition: AppCondition = {
        id: `new-${Date.now()}-${Math.random()}`,
        fhirId: '',
        name: entry.code?.description || entry.term,
        clinicalStatus: 'active',
        verificationStatus: 'unconfirmed',
        severity: '',
        onsetDate: '',
        abatementDate: '',
        bodySite: '',
        coding: entry.code ? {
          system: 'http://hl7.org/fhir/sid/icd-10-cm',
          code: entry.code.code,
          display: entry.code.description,
        } : undefined,
      };

      const result = await createFhirCondition(newCondition, activePatient.fhirId);
      if (!result.success) {
        setSyncError(result.error || `Failed to create condition: ${entry.term}`);
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

      // Re-fetch conditions list from Medplum
      const refreshed = await searchFhirConditions(activePatient.fhirId);
      if (!refreshed.error) {
        setConditions(refreshed.conditions);
      }
    } else {
      setSyncStatus('error');
    }
  };

  if (!activePatient) return null;

  return (
    <div className="py-8 px-8">
      <div className="flex flex-col items-center gap-6">

        {/* ── Structured Conditions Card (Labs/Imaging pattern) ── */}
        <div className="bg-white rounded-lg shadow-sm border p-8 w-full max-w-xl">
          <h2 className="text-xl font-semibold mb-6">Conditions</h2>

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
              Loading conditions...
            </div>
          )}

          {/* Empty state */}
          {status !== 'loading' && conditions.length === 0 && status !== 'error' && (
            <div className="text-gray-400 text-sm text-center py-8">
              No conditions found in Medplum
            </div>
          )}

          {/* Conditions list */}
          {conditions.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 mb-2">
                {conditions.length} condition{conditions.length !== 1 ? 's' : ''} from Medplum
              </p>
              {conditions.map((condition) => (
                <div
                  key={condition.id}
                  className="p-4 border border-gray-200 rounded-lg"
                >
                  {editingId === condition.id ? (
                    /* Edit mode */
                    <div className="space-y-3">
                      <input
                        className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={editForm.name || ''}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        placeholder="Condition name"
                      />
                      {condition.coding?.code && (
                        <p className="text-xs text-gray-500">
                          ICD-10: {condition.coding.code}{condition.coding.display ? ` — ${condition.coding.display}` : ''}
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          value={editForm.clinicalStatus || condition.clinicalStatus}
                          onChange={(e) => setEditForm({ ...editForm, clinicalStatus: e.target.value as AppCondition['clinicalStatus'] })}
                        >
                          <option value="active">Active</option>
                          <option value="recurrence">Recurrence</option>
                          <option value="relapse">Relapse</option>
                          <option value="inactive">Inactive</option>
                          <option value="remission">Remission</option>
                          <option value="resolved">Resolved</option>
                        </select>
                        <select
                          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          value={editForm.verificationStatus || condition.verificationStatus}
                          onChange={(e) => setEditForm({ ...editForm, verificationStatus: e.target.value as AppCondition['verificationStatus'] })}
                        >
                          <option value="confirmed">Confirmed</option>
                          <option value="unconfirmed">Unconfirmed</option>
                          <option value="provisional">Provisional</option>
                          <option value="differential">Differential</option>
                          <option value="refuted">Refuted</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          type="date"
                          value={editForm.onsetDate || ''}
                          onChange={(e) => setEditForm({ ...editForm, onsetDate: e.target.value })}
                        />
                        <input
                          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={editForm.severity || ''}
                          onChange={(e) => setEditForm({ ...editForm, severity: e.target.value })}
                          placeholder="Severity"
                        />
                      </div>
                      <input
                        className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={editForm.note || ''}
                        onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                        placeholder="Note"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSave(condition)}
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
                          onClick={() => handleDelete(condition)}
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
                      onClick={() => handleEdit(condition)}
                    >
                      <div>
                        <p className="font-medium text-sm text-gray-900">{condition.name}</p>
                        {condition.coding?.code && (
                          <p className="text-xs text-gray-500 mt-1">
                            ICD-10: {condition.coding.code}{condition.coding.display ? ` — ${condition.coding.display}` : ''}
                          </p>
                        )}
                        {condition.onsetDate && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Onset: {new Date(condition.onsetDate).toLocaleDateString()}
                          </p>
                        )}
                        {condition.note && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">Note: {condition.note}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          condition.clinicalStatus === 'active'
                            ? 'bg-red-100 text-red-700'
                            : condition.clinicalStatus === 'resolved'
                            ? 'bg-green-100 text-green-700'
                            : condition.clinicalStatus === 'remission'
                            ? 'bg-blue-100 text-blue-700'
                            : condition.clinicalStatus === 'inactive'
                            ? 'bg-gray-100 text-gray-500'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {condition.clinicalStatus}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          condition.verificationStatus === 'confirmed'
                            ? 'bg-green-100 text-green-700'
                            : condition.verificationStatus === 'refuted'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {condition.verificationStatus}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {isFhirPatient && status === 'idle' && conditions.length > 0 && (
            <p className="text-xs text-gray-400 text-center mt-4">
              Click a condition to edit · Changes will be saved to Medplum
            </p>
          )}
        </div>

        {/* ── Add Conditions Card (free-text sync area) ── */}
        {isFhirPatient && (
          <div className="bg-white rounded-lg shadow-sm border p-8 w-full max-w-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Add Conditions</h2>
              <button
                onClick={handleSyncToMedplum}
                disabled={syncStatus === 'resolving' || syncStatus === 'syncing'}
                className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {syncStatus === 'resolving'
                  ? 'Resolving...'
                  : syncStatus === 'syncing'
                    ? 'Syncing...'
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
                Conditions synced to Medplum
              </div>
            )}

            {syncStatus === 'resolving' && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
                Resolving ICD-10 codes...
              </div>
            )}

            {syncStatus === 'syncing' && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
                Creating conditions in Medplum...
              </div>
            )}

            {/* Resolved entries preview */}
            {resolvedEntries.length > 0 && syncStatus !== 'idle' && syncStatus !== 'error' && (
              <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
                <p className="text-xs text-gray-500 mb-2">Resolved diagnoses:</p>
                <div className="space-y-1">
                  {resolvedEntries.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-gray-400">{entry.term}</span>
                      <span className="text-gray-300">&rarr;</span>
                      {entry.code ? (
                        <>
                          <span className="font-mono text-blue-600">{entry.code.code}</span>
                          <span className="text-gray-700">{entry.code.description}</span>
                        </>
                      ) : (
                        <span className="text-orange-500">No ICD-10 match (will use free text)</span>
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
              data-placeholder="Type conditions here (e.g. ckd, htn, dm and depression) then click Sync..."
            />
            <p className="text-xs text-gray-400 mt-2">
              Separate conditions with commas, newlines, or &quot;and&quot; · Common abbreviations are expanded automatically
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
