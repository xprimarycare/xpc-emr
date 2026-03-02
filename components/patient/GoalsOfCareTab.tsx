'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePatient } from '@/lib/context/PatientContext';
import { AppGoal } from '@/lib/types/goal';
import {
  searchFhirGoals,
  upsertFhirGoal,
  deleteFhirGoal,
  createFhirGoal,
  batchResolveGoals,
  ResolvedGoalEntry,
} from '@/lib/services/fhir-goal-service';

type SaveStatus = 'idle' | 'loading' | 'saving' | 'success' | 'error';
type SyncStatus = 'idle' | 'resolving' | 'syncing' | 'success' | 'error';

export function GoalsOfCareTab({ refreshKey }: { refreshKey?: number }) {
  const { activePatient } = usePatient();
  const isFhirPatient = !!activePatient?.fhirId;
  const editorRef = useRef<HTMLDivElement>(null);

  const [goals, setGoals] = useState<AppGoal[]>([]);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AppGoal>>({});

  // Sync state
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [resolvedEntries, setResolvedEntries] = useState<ResolvedGoalEntry[]>([]);

  // Fetch goals when FHIR patient changes
  useEffect(() => {
    if (!isFhirPatient || !activePatient?.fhirId) {
      setGoals([]);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setError(null);
    searchFhirGoals(activePatient.fhirId).then((result) => {
      if (cancelled) return;
      if (result.error) {
        setError(result.error);
        setStatus('error');
      } else {
        setGoals(result.goals);
        setError(null);
        setStatus('idle');
      }
    });
    return () => { cancelled = true; };
  }, [activePatient?.fhirId, isFhirPatient, refreshKey]);

  const handleEdit = (goal: AppGoal) => {
    setEditingId(goal.id);
    setEditForm({ ...goal });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async (goal: AppGoal) => {
    if (!activePatient?.fhirId) return;

    const updated = { ...goal, ...editForm } as AppGoal;
    const previousGoals = goals;

    setGoals((prev) =>
      prev.map((g) => (g.id === goal.id ? updated : g))
    );
    setEditingId(null);
    setEditForm({});

    setStatus('saving');
    setError(null);
    const result = await upsertFhirGoal(updated, activePatient.fhirId);
    if (result.success) {
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } else {
      setGoals(previousGoals);
      setError(result.error || 'Failed to save');
      setStatus('error');
    }
  };

  const handleDelete = async (goal: AppGoal) => {
    if (!goal.fhirId) return;

    const previousGoals = goals;
    setGoals((prev) => prev.filter((g) => g.id !== goal.id));
    setEditingId(null);
    setEditForm({});

    setStatus('saving');
    setError(null);
    const result = await deleteFhirGoal(goal.fhirId);
    if (result.success) {
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } else {
      setGoals(previousGoals);
      setError(result.error || 'Failed to delete');
      setStatus('error');
    }
  };

  const handleSyncToMedplum = async () => {
    if (!activePatient?.fhirId) return;

    const text = editorRef.current?.innerText || '';
    if (!text.trim()) {
      setSyncError('Type some goals before syncing.');
      setSyncStatus('error');
      return;
    }

    // Step 1: Resolve all terms to SNOMED codes
    setSyncStatus('resolving');
    setSyncError(null);
    setResolvedEntries([]);

    const resolved = await batchResolveGoals(text);
    if (resolved.entries.length === 0) {
      setSyncError(resolved.error || 'No goals could be parsed from the text.');
      setSyncStatus('error');
      return;
    }

    setResolvedEntries(resolved.entries);

    // Step 2: Create each as a Goal in Medplum
    setSyncStatus('syncing');
    let allSuccess = true;

    for (const entry of resolved.entries) {
      const newGoal: AppGoal = {
        id: `new-${Date.now()}-${Math.random()}`,
        fhirId: '',
        name: entry.code?.description || entry.term,
        lifecycleStatus: 'active',
        coding: entry.code ? {
          system: 'http://snomed.info/sct',
          code: entry.code.code,
          display: entry.code.description,
        } : undefined,
      };

      const result = await createFhirGoal(newGoal, activePatient.fhirId);
      if (!result.success) {
        setSyncError(result.error || `Failed to create goal: ${entry.term}`);
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

      // Re-fetch goals list from Medplum
      const refreshed = await searchFhirGoals(activePatient.fhirId);
      if (!refreshed.error) {
        setGoals(refreshed.goals);
      }
    } else {
      setSyncStatus('error');
    }
  };

  if (!activePatient) return null;

  const statusColor = (s: AppGoal['lifecycleStatus']) => {
    switch (s) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'completed': return 'bg-blue-100 text-blue-700';
      case 'proposed': case 'planned': return 'bg-yellow-100 text-yellow-700';
      case 'on-hold': return 'bg-orange-100 text-orange-700';
      case 'cancelled': case 'rejected': return 'bg-red-100 text-red-700';
      case 'entered-in-error': return 'bg-gray-100 text-gray-500';
      default: return 'bg-gray-100 text-gray-500';
    }
  };

  return (
    <div className="py-8 px-8">
      <div className="flex flex-col items-center gap-6">

        {/* Structured Goals Card */}
        <div className="bg-white rounded-lg shadow-sm border p-8 w-full max-w-xl">
          <h2 className="text-xl font-semibold mb-6">Goals of Care</h2>

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
              Loading goals...
            </div>
          )}

          {/* Empty state */}
          {status !== 'loading' && goals.length === 0 && status !== 'error' && (
            <div className="text-gray-400 text-sm text-center py-8">
              No goals found in Medplum
            </div>
          )}

          {/* Goals list */}
          {goals.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 mb-2">
                {goals.length} goal{goals.length !== 1 ? 's' : ''} from Medplum
              </p>
              {goals.map((goal) => (
                <div
                  key={goal.id}
                  className="p-4 border border-gray-200 rounded-lg"
                >
                  {editingId === goal.id ? (
                    /* Edit mode */
                    <div className="space-y-3">
                      <input
                        className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={editForm.name || ''}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        placeholder="Goal description"
                      />
                      {goal.coding?.code && (
                        <p className="text-xs text-gray-500">
                          SNOMED: {goal.coding.code}{goal.coding.display ? ` — ${goal.coding.display}` : ''}
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          value={editForm.lifecycleStatus || goal.lifecycleStatus}
                          onChange={(e) => setEditForm({ ...editForm, lifecycleStatus: e.target.value as AppGoal['lifecycleStatus'] })}
                        >
                          <option value="proposed">Proposed</option>
                          <option value="planned">Planned</option>
                          <option value="accepted">Accepted</option>
                          <option value="active">Active</option>
                          <option value="on-hold">On Hold</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                          <option value="rejected">Rejected</option>
                          <option value="entered-in-error">Entered in Error</option>
                        </select>
                        <input
                          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={editForm.expressedBy || ''}
                          onChange={(e) => setEditForm({ ...editForm, expressedBy: e.target.value })}
                          placeholder="Expressed by"
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
                          onClick={() => handleSave(goal)}
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
                          onClick={() => handleDelete(goal)}
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
                      onClick={() => handleEdit(goal)}
                    >
                      <div>
                        <p className="font-medium text-sm text-gray-900">{goal.name}</p>
                        {goal.coding?.code && (
                          <p className="text-xs text-gray-500 mt-1">
                            SNOMED: {goal.coding.code}{goal.coding.display ? ` — ${goal.coding.display}` : ''}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          {[goal.expressedBy && `Expressed by: ${goal.expressedBy}`, goal.startDate && `Started: ${new Date(goal.startDate).toLocaleDateString()}`].filter(Boolean).join(' · ')}
                        </p>
                        {goal.note && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">Note: {goal.note}</p>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${statusColor(goal.lifecycleStatus)}`}>
                        {goal.lifecycleStatus}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {isFhirPatient && status === 'idle' && goals.length > 0 && (
            <p className="text-xs text-gray-400 text-center mt-4">
              Click a goal to edit · Changes will be saved to Medplum
            </p>
          )}
        </div>

        {/* Add Goals Card (free-text sync area) */}
        {isFhirPatient && (
          <div className="bg-white rounded-lg shadow-sm border p-8 w-full max-w-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Add Goals</h2>
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
                Goals synced to Medplum
              </div>
            )}

            {syncStatus === 'resolving' && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
                Resolving SNOMED codes...
              </div>
            )}

            {syncStatus === 'syncing' && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
                Creating goals in Medplum...
              </div>
            )}

            {/* Resolved entries preview */}
            {resolvedEntries.length > 0 && syncStatus !== 'idle' && syncStatus !== 'error' && (
              <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
                <p className="text-xs text-gray-500 mb-2">Resolved goals:</p>
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
              data-placeholder="Type goals here (e.g. comfort care, dnr, palliative care) then click Sync..."
            />
            <p className="text-xs text-gray-400 mt-2">
              Separate goals with commas, newlines, or &quot;and&quot; · Common abbreviations (DNR, CMO, POLST) are expanded automatically
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
