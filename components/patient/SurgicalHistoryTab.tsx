'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePatient } from '@/lib/context/PatientContext';
import { AppProcedure } from '@/lib/types/procedure';
import {
  searchFhirProcedures,
  upsertFhirProcedure,
  deleteFhirProcedure,
  createFhirProcedure,
  batchResolveProcedures,
  ResolvedProcedureEntry,
} from '@/lib/services/fhir-procedure-service';

type SaveStatus = 'idle' | 'loading' | 'saving' | 'success' | 'error';
type SyncStatus = 'idle' | 'resolving' | 'syncing' | 'success' | 'error';

export function SurgicalHistoryTab({ refreshKey }: { refreshKey?: number }) {
  const { activePatient } = usePatient();
  const isFhirPatient = !!activePatient?.fhirId;
  const editorRef = useRef<HTMLDivElement>(null);

  const [procedures, setProcedures] = useState<AppProcedure[]>([]);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AppProcedure>>({});

  // Sync state
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [resolvedEntries, setResolvedEntries] = useState<ResolvedProcedureEntry[]>([]);

  // Fetch procedures when FHIR patient changes
  useEffect(() => {
    if (!isFhirPatient || !activePatient?.fhirId) {
      setProcedures([]);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setError(null);
    searchFhirProcedures(activePatient.fhirId).then((result) => {
      if (cancelled) return;
      if (result.error) {
        setError(result.error);
        setStatus('error');
      } else {
        setProcedures(result.procedures);
        setError(null);
        setStatus('idle');
      }
    });
    return () => { cancelled = true; };
  }, [activePatient?.fhirId, isFhirPatient, refreshKey]);

  const handleEdit = (procedure: AppProcedure) => {
    setEditingId(procedure.id);
    setEditForm({ ...procedure });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async (procedure: AppProcedure) => {
    if (!activePatient?.fhirId) return;

    const updated = { ...procedure, ...editForm } as AppProcedure;
    const previousProcedures = procedures;

    setProcedures((prev) =>
      prev.map((p) => (p.id === procedure.id ? updated : p))
    );
    setEditingId(null);
    setEditForm({});

    setStatus('saving');
    setError(null);
    const result = await upsertFhirProcedure(updated, activePatient.fhirId);
    if (result.success) {
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } else {
      setProcedures(previousProcedures);
      setError(result.error || 'Failed to save');
      setStatus('error');
    }
  };

  const handleDelete = async (procedure: AppProcedure) => {
    if (!procedure.fhirId) return;

    const previousProcedures = procedures;
    setProcedures((prev) => prev.filter((p) => p.id !== procedure.id));
    setEditingId(null);
    setEditForm({});

    setStatus('saving');
    setError(null);
    const result = await deleteFhirProcedure(procedure.fhirId);
    if (result.success) {
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } else {
      setProcedures(previousProcedures);
      setError(result.error || 'Failed to delete');
      setStatus('error');
    }
  };

  const handleSync = async () => {
    if (!activePatient?.fhirId) return;

    const text = editorRef.current?.innerText || '';
    if (!text.trim()) {
      setSyncError('Type some procedures before syncing.');
      setSyncStatus('error');
      return;
    }

    // Step 1: Resolve all terms to SNOMED codes
    setSyncStatus('resolving');
    setSyncError(null);
    setResolvedEntries([]);

    const resolved = await batchResolveProcedures(text);
    if (resolved.entries.length === 0) {
      setSyncError(resolved.error || 'No procedures could be parsed from the text.');
      setSyncStatus('error');
      return;
    }

    setResolvedEntries(resolved.entries);

    // Step 2: Create each as a Procedure in EMR
    setSyncStatus('syncing');
    let allSuccess = true;

    for (const entry of resolved.entries) {
      const newProcedure: AppProcedure = {
        id: `new-${Date.now()}-${Math.random()}`,
        fhirId: '',
        name: entry.code?.description || entry.term,
        status: 'completed',
        performedDate: '',
        bodySite: '',
        outcome: '',
        coding: entry.code ? {
          system: 'http://snomed.info/sct',
          code: entry.code.code,
          display: entry.code.description,
        } : undefined,
      };

      const result = await createFhirProcedure(newProcedure, activePatient.fhirId);
      if (!result.success) {
        setSyncError(result.error || `Failed to create procedure: ${entry.term}`);
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

      // Re-fetch procedures list from EMR
      const refreshed = await searchFhirProcedures(activePatient.fhirId);
      if (!refreshed.error) {
        setProcedures(refreshed.procedures);
      }
    } else {
      setSyncStatus('error');
    }
  };

  if (!activePatient) return null;

  return (
    <div className="py-8 px-8">
      <div className="flex flex-col items-center gap-6">

        {/* Structured Procedures Card */}
        <div className="bg-white rounded-lg shadow-sm border p-8 w-full max-w-xl">
          <h2 className="text-xl font-semibold mb-6">Surgical History</h2>

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
              Loading procedures...
            </div>
          )}

          {/* Empty state */}
          {status !== 'loading' && procedures.length === 0 && status !== 'error' && (
            <div className="text-gray-400 text-sm text-center py-8">
              No procedures found in EMR
            </div>
          )}

          {/* Procedures list */}
          {procedures.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 mb-2">
                {procedures.length} procedure{procedures.length !== 1 ? 's' : ''} from EMR
              </p>
              {procedures.map((procedure) => (
                <div
                  key={procedure.id}
                  className="p-4 border border-gray-200 rounded-lg"
                >
                  {editingId === procedure.id ? (
                    /* Edit mode */
                    <div className="space-y-3">
                      <input
                        className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={editForm.name || ''}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        placeholder="Procedure name"
                      />
                      {procedure.coding?.code && (
                        <p className="text-xs text-gray-500">
                          SNOMED: {procedure.coding.code}{procedure.coding.display ? ` — ${procedure.coding.display}` : ''}
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          value={editForm.status || procedure.status}
                          onChange={(e) => setEditForm({ ...editForm, status: e.target.value as AppProcedure['status'] })}
                        >
                          <option value="completed">Completed</option>
                          <option value="in-progress">In Progress</option>
                          <option value="preparation">Preparation</option>
                          <option value="on-hold">On Hold</option>
                          <option value="stopped">Stopped</option>
                          <option value="not-done">Not Done</option>
                          <option value="entered-in-error">Entered in Error</option>
                          <option value="unknown">Unknown</option>
                        </select>
                        <input
                          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          type="date"
                          value={editForm.performedDate || ''}
                          onChange={(e) => setEditForm({ ...editForm, performedDate: e.target.value })}
                          placeholder="Performed date"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={editForm.bodySite || ''}
                          onChange={(e) => setEditForm({ ...editForm, bodySite: e.target.value })}
                          placeholder="Body site"
                        />
                        <input
                          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={editForm.outcome || ''}
                          onChange={(e) => setEditForm({ ...editForm, outcome: e.target.value })}
                          placeholder="Outcome"
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
                          onClick={() => handleSave(procedure)}
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
                          onClick={() => handleDelete(procedure)}
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
                      onClick={() => handleEdit(procedure)}
                    >
                      <div>
                        <p className="font-medium text-sm text-gray-900">{procedure.name}</p>
                        {procedure.coding?.code && (
                          <p className="text-xs text-gray-500 mt-1">
                            SNOMED: {procedure.coding.code}{procedure.coding.display ? ` — ${procedure.coding.display}` : ''}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          {[procedure.performedDate && `Performed: ${new Date(procedure.performedDate).toLocaleDateString()}`, procedure.bodySite, procedure.outcome].filter(Boolean).join(' · ')}
                        </p>
                        {procedure.note && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">Note: {procedure.note}</p>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        procedure.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : procedure.status === 'in-progress'
                            ? 'bg-blue-100 text-blue-700'
                            : procedure.status === 'not-done' || procedure.status === 'stopped'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-500'
                      }`}>
                        {procedure.status}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {isFhirPatient && status === 'idle' && procedures.length > 0 && (
            <p className="text-xs text-gray-400 text-center mt-4">
              Click a procedure to edit · Changes will be saved to EMR
            </p>
          )}
        </div>

        {/* Add Procedures Card (free-text sync area) */}
        {isFhirPatient && (
          <div className="bg-white rounded-lg shadow-sm border p-8 w-full max-w-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Add Procedures</h2>
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
                Procedures synced
              </div>
            )}

            {syncStatus === 'resolving' && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
                Resolving SNOMED codes...
              </div>
            )}

            {syncStatus === 'syncing' && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
                Creating procedures...
              </div>
            )}

            {/* Resolved entries preview */}
            {resolvedEntries.length > 0 && syncStatus !== 'idle' && syncStatus !== 'error' && (
              <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
                <p className="text-xs text-gray-500 mb-2">Resolved procedures:</p>
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
                        <span className="text-orange-500">No SNOMED match (will use free text)</span>
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
              data-placeholder="Type procedures here (e.g. appy, chole, cabg and tkr) then click Sync..."
            />
            <p className="text-xs text-gray-400 mt-2">
              Separate procedures with commas, newlines, or &quot;and&quot; · Common abbreviations are expanded automatically
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
