'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePatient } from '@/lib/context/PatientContext';
import { AppFamilyMemberHistory, AppFamilyCondition } from '@/lib/types/family-history';
import {
  searchFhirFamilyHistories,
  upsertFhirFamilyHistory,
  deleteFhirFamilyHistory,
  createFhirFamilyHistory,
  batchResolveFamilyHistory,
  ResolvedFamilyEntry,
  RELATIONSHIP_KEYWORDS,
} from '@/lib/services/fhir-family-history-service';

type SaveStatus = 'idle' | 'loading' | 'saving' | 'success' | 'error';
type SyncStatus = 'idle' | 'resolving' | 'syncing' | 'success' | 'error';

const RELATIONSHIP_OPTIONS = Object.entries(RELATIONSHIP_KEYWORDS)
  .filter(([key]) => !['dad', 'mom', 'grandpa', 'grandma', 'grandson', 'granddaughter'].includes(key))
  .map(([, val]) => val)
  .filter((v, i, arr) => arr.findIndex((x) => x.code === v.code) === i);

export function FamilyHistoryTab({ refreshKey }: { refreshKey?: number }) {
  const { activePatient } = usePatient();
  const isFhirPatient = !!activePatient?.fhirId;
  const editorRef = useRef<HTMLDivElement>(null);

  const [members, setMembers] = useState<AppFamilyMemberHistory[]>([]);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Accordion state — tracks which members are collapsed (all expanded by default)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  // Editing state: member-level or condition-level
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingConditionIdx, setEditingConditionIdx] = useState<number | null>(null);
  const [editMemberForm, setEditMemberForm] = useState<Partial<AppFamilyMemberHistory>>({});
  const [editConditionForm, setEditConditionForm] = useState<Partial<AppFamilyCondition>>({});

  // Sync state
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [resolvedEntries, setResolvedEntries] = useState<ResolvedFamilyEntry[]>([]);

  // Fetch family history when FHIR patient changes
  useEffect(() => {
    if (!isFhirPatient || !activePatient?.fhirId) {
      setMembers([]);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setError(null);
    searchFhirFamilyHistories(activePatient.fhirId).then((result) => {
      if (cancelled) return;
      if (result.error) {
        setError(result.error);
        setStatus('error');
      } else {
        setMembers(result.members);
        setError(null);
        setStatus('idle');
      }
    });
    return () => { cancelled = true; };
  }, [activePatient?.fhirId, isFhirPatient, refreshKey]);

  // --- Accordion ---

  const toggleExpand = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    cancelEditing();
  };

  // --- Editing helpers ---

  const cancelEditing = () => {
    setEditingMemberId(null);
    setEditingConditionIdx(null);
    setEditMemberForm({});
    setEditConditionForm({});
  };

  const startEditMember = (member: AppFamilyMemberHistory, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingMemberId(member.id);
    setEditingConditionIdx(null);
    setEditMemberForm({ ...member });
    setEditConditionForm({});
  };

  const startEditCondition = (memberId: string, condIdx: number, cond: AppFamilyCondition) => {
    setEditingMemberId(memberId);
    setEditingConditionIdx(condIdx);
    setEditConditionForm({ ...cond });
    setEditMemberForm({});
  };

  // --- Save member ---

  const handleSaveMember = async (member: AppFamilyMemberHistory) => {
    if (!activePatient?.fhirId) return;

    const updated = {
      ...member,
      name: editMemberForm.name ?? member.name,
      relationship: editMemberForm.relationship ?? member.relationship,
      relationshipDisplay: editMemberForm.relationshipDisplay ?? member.relationshipDisplay,
      status: editMemberForm.status ?? member.status,
      deceased: editMemberForm.deceased ?? member.deceased,
      note: editMemberForm.note ?? member.note,
    } as AppFamilyMemberHistory;

    const previousMembers = members;
    setMembers((prev) => prev.map((m) => (m.id === member.id ? updated : m)));
    cancelEditing();

    setStatus('saving');
    setError(null);
    const result = await upsertFhirFamilyHistory(updated, activePatient.fhirId);
    if (result.success) {
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } else {
      setMembers(previousMembers);
      setError(result.error || 'Failed to save');
      setStatus('error');
    }
  };

  // --- Save condition within a member ---

  const handleSaveCondition = async (member: AppFamilyMemberHistory, condIdx: number) => {
    if (!activePatient?.fhirId) return;

    const updatedConditions = [...member.conditions];
    updatedConditions[condIdx] = {
      ...updatedConditions[condIdx],
      ...editConditionForm,
    } as AppFamilyCondition;

    const updated = { ...member, conditions: updatedConditions };
    const previousMembers = members;
    setMembers((prev) => prev.map((m) => (m.id === member.id ? updated : m)));
    cancelEditing();

    setStatus('saving');
    setError(null);
    const result = await upsertFhirFamilyHistory(updated, activePatient.fhirId);
    if (result.success) {
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } else {
      setMembers(previousMembers);
      setError(result.error || 'Failed to save');
      setStatus('error');
    }
  };

  // --- Delete member ---

  const handleDeleteMember = async (member: AppFamilyMemberHistory) => {
    if (!member.fhirId) return;

    const previousMembers = members;
    setMembers((prev) => prev.filter((m) => m.id !== member.id));
    cancelEditing();

    setStatus('saving');
    setError(null);
    const result = await deleteFhirFamilyHistory(member.fhirId);
    if (result.success) {
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } else {
      setMembers(previousMembers);
      setError(result.error || 'Failed to delete');
      setStatus('error');
    }
  };

  // --- Delete condition within a member ---

  const handleDeleteCondition = async (member: AppFamilyMemberHistory, condIdx: number) => {
    if (!activePatient?.fhirId) return;

    const updatedConditions = member.conditions.filter((_, i) => i !== condIdx);
    const updated = { ...member, conditions: updatedConditions };
    const previousMembers = members;
    setMembers((prev) => prev.map((m) => (m.id === member.id ? updated : m)));
    cancelEditing();

    setStatus('saving');
    setError(null);
    const result = await upsertFhirFamilyHistory(updated, activePatient.fhirId);
    if (result.success) {
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } else {
      setMembers(previousMembers);
      setError(result.error || 'Failed to save');
      setStatus('error');
    }
  };

  // --- Free-text sync ---

  const handleSync = async () => {
    if (!activePatient?.fhirId) return;

    const text = editorRef.current?.innerText || '';
    if (!text.trim()) {
      setSyncError('Type family history before syncing.');
      setSyncStatus('error');
      return;
    }

    setSyncStatus('resolving');
    setSyncError(null);
    setResolvedEntries([]);

    const resolved = await batchResolveFamilyHistory(text);
    if (resolved.entries.length === 0) {
      setSyncError(resolved.error || 'No family members could be parsed from the text.');
      setSyncStatus('error');
      return;
    }

    setResolvedEntries(resolved.entries);

    // Create each family member as a FamilyMemberHistory in EMR
    setSyncStatus('syncing');
    let allSuccess = true;

    for (const entry of resolved.entries) {
      const conditions: AppFamilyCondition[] = entry.resolvedConditions.map((rc) => ({
        name: rc.code?.description || rc.term,
        onsetAge: rc.onsetAge,
        coding: rc.code ? {
          system: 'http://snomed.info/sct',
          code: rc.code.code,
          display: rc.code.description,
        } : undefined,
      }));

      const newMember: AppFamilyMemberHistory = {
        id: `new-${Date.now()}-${Math.random()}`,
        fhirId: '',
        name: entry.relationship?.display || entry.relationshipTerm,
        relationship: entry.relationship?.code || 'FAMMEMB',
        relationshipDisplay: entry.relationship?.display || entry.relationshipTerm,
        status: 'completed',
        deceased: entry.deceased,
        deceasedAge: entry.deceasedAge,
        conditions,
      };

      const result = await createFhirFamilyHistory(newMember, activePatient.fhirId);
      if (!result.success) {
        setSyncError(result.error || `Failed to create: ${entry.relationshipTerm}`);
        allSuccess = false;
        break;
      }
    }

    if (allSuccess) {
      if (editorRef.current) editorRef.current.textContent = '';
      setResolvedEntries([]);
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 2000);

      const refreshed = await searchFhirFamilyHistories(activePatient.fhirId);
      if (!refreshed.error) setMembers(refreshed.members);
    } else {
      setSyncStatus('error');
    }
  };

  if (!activePatient) return null;

  return (
    <div className="py-8 px-8">
      <div className="flex flex-col items-center gap-6">

        {/* Structured Family History Card */}
        <div className="bg-white rounded-lg shadow-sm border p-8 w-full max-w-xl">
          <h2 className="text-xl font-semibold mb-6">Family History</h2>

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

          {status === 'loading' && (
            <div className="text-gray-400 text-sm text-center py-8">
              Loading family history...
            </div>
          )}

          {status !== 'loading' && members.length === 0 && status !== 'error' && (
            <div className="text-gray-400 text-sm text-center py-8">
              No family history found in EMR
            </div>
          )}

          {/* Members accordion list */}
          {members.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">
                {members.length} family member{members.length !== 1 ? 's' : ''} from EMR
              </p>
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
                {members.map((member) => {
                  const isExpanded = !collapsedIds.has(member.id);
                  const isEditingThisMember = editingMemberId === member.id && editingConditionIdx === null;

                  return (
                    <div key={member.id}>
                      {/* Accordion header */}
                      <div
                        className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => toggleExpand(member.id)}
                      >
                        <span className={`text-gray-400 text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                          &#9654;
                        </span>
                        <span className="font-medium text-sm text-gray-900">
                          {member.relationshipDisplay || member.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          — {member.deceased ? `Deceased${member.deceasedAge ? ` (age ${member.deceasedAge})` : ''}` : 'Living'}
                        </span>
                        <span className="ml-auto">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            member.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : member.status === 'partial'
                                ? 'bg-blue-100 text-blue-700'
                                : member.status === 'health-unknown'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-100 text-gray-500'
                          }`}>
                            {member.status}
                          </span>
                        </span>
                      </div>

                      {/* Accordion body */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pl-10">
                          {/* Member edit form */}
                          {isEditingThisMember ? (
                            <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                              <input
                                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={editMemberForm.name || ''}
                                onChange={(e) => setEditMemberForm({ ...editMemberForm, name: e.target.value })}
                                placeholder="Name"
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <select
                                  className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                  value={editMemberForm.relationship || member.relationship}
                                  onChange={(e) => {
                                    const opt = RELATIONSHIP_OPTIONS.find((r) => r.code === e.target.value);
                                    setEditMemberForm({
                                      ...editMemberForm,
                                      relationship: e.target.value,
                                      relationshipDisplay: opt?.display || e.target.value,
                                    });
                                  }}
                                >
                                  {RELATIONSHIP_OPTIONS.map((r) => (
                                    <option key={r.code} value={r.code}>{r.display}</option>
                                  ))}
                                </select>
                                <select
                                  className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                  value={editMemberForm.status || member.status}
                                  onChange={(e) => setEditMemberForm({ ...editMemberForm, status: e.target.value as AppFamilyMemberHistory['status'] })}
                                >
                                  <option value="completed">Completed</option>
                                  <option value="partial">Partial</option>
                                  <option value="health-unknown">Health Unknown</option>
                                  <option value="entered-in-error">Entered in Error</option>
                                </select>
                              </div>
                              <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 text-sm text-gray-700">
                                  <input
                                    type="checkbox"
                                    checked={editMemberForm.deceased ?? member.deceased ?? false}
                                    onChange={(e) => setEditMemberForm({ ...editMemberForm, deceased: e.target.checked })}
                                  />
                                  Deceased
                                </label>
                              </div>
                              <input
                                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={editMemberForm.note ?? member.note ?? ''}
                                onChange={(e) => setEditMemberForm({ ...editMemberForm, note: e.target.value })}
                                placeholder="Note"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleSaveMember(member)}
                                  disabled={status === 'saving'}
                                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {status === 'saving' ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                  onClick={cancelEditing}
                                  className="px-4 py-2 bg-gray-100 text-gray-600 rounded-md text-sm hover:bg-gray-200 transition-colors"
                                >
                                  Cancel
                                </button>
                                <div className="flex-1" />
                                <button
                                  onClick={() => handleDeleteMember(member)}
                                  disabled={status === 'saving'}
                                  className="px-4 py-2 bg-red-50 text-red-600 rounded-md text-sm hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Delete Member
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => startEditMember(member, e)}
                              className="mb-3 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              Edit member details
                            </button>
                          )}

                          {/* Conditions list */}
                          {member.conditions.length === 0 && (
                            <p className="text-xs text-gray-400 mb-2">No conditions recorded</p>
                          )}
                          {member.conditions.map((cond, condIdx) => {
                            const isEditingThisCondition =
                              editingMemberId === member.id && editingConditionIdx === condIdx;

                            return isEditingThisCondition ? (
                              <div key={condIdx} className="mb-3 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                                <input
                                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  value={editConditionForm.name || ''}
                                  onChange={(e) => setEditConditionForm({ ...editConditionForm, name: e.target.value })}
                                  placeholder="Condition name"
                                />
                                {cond.coding?.code && (
                                  <p className="text-xs text-gray-500">
                                    SNOMED: {cond.coding.code}{cond.coding.display ? ` — ${cond.coding.display}` : ''}
                                  </p>
                                )}
                                <div className="grid grid-cols-2 gap-2">
                                  <input
                                    className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={editConditionForm.onsetAge || ''}
                                    onChange={(e) => setEditConditionForm({ ...editConditionForm, onsetAge: e.target.value })}
                                    placeholder="Onset age (e.g. 65)"
                                  />
                                  <input
                                    className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={editConditionForm.outcome || ''}
                                    onChange={(e) => setEditConditionForm({ ...editConditionForm, outcome: e.target.value })}
                                    placeholder="Outcome"
                                  />
                                </div>
                                <label className="flex items-center gap-2 text-sm text-gray-700">
                                  <input
                                    type="checkbox"
                                    checked={editConditionForm.contributedToDeath ?? cond.contributedToDeath ?? false}
                                    onChange={(e) => setEditConditionForm({ ...editConditionForm, contributedToDeath: e.target.checked })}
                                  />
                                  Contributed to death
                                </label>
                                <input
                                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  value={editConditionForm.note ?? ''}
                                  onChange={(e) => setEditConditionForm({ ...editConditionForm, note: e.target.value })}
                                  placeholder="Note"
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleSaveCondition(member, condIdx)}
                                    disabled={status === 'saving'}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {status === 'saving' ? 'Saving...' : 'Save'}
                                  </button>
                                  <button
                                    onClick={cancelEditing}
                                    className="px-4 py-2 bg-gray-100 text-gray-600 rounded-md text-sm hover:bg-gray-200 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <div className="flex-1" />
                                  <button
                                    onClick={() => handleDeleteCondition(member, condIdx)}
                                    disabled={status === 'saving'}
                                    className="px-4 py-2 bg-red-50 text-red-600 rounded-md text-sm hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div
                                key={condIdx}
                                className="py-2 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded"
                                onClick={() => startEditCondition(member.id, condIdx, cond)}
                              >
                                <div className="flex items-center gap-1.5 text-sm text-gray-900">
                                  <span className="text-gray-400">&bull;</span>
                                  <span className="font-medium">{cond.name}</span>
                                </div>
                                <div className="ml-4 text-xs text-gray-500 flex gap-3 mt-0.5">
                                  {cond.coding?.code && (
                                    <span className="text-purple-600">SNOMED: {cond.coding.code}</span>
                                  )}
                                  {cond.onsetAge && <span>Onset: {cond.onsetAge} yrs</span>}
                                  {cond.contributedToDeath && (
                                    <span className="text-red-500">Contributed to death</span>
                                  )}
                                </div>
                                {cond.note && (
                                  <p className="ml-4 text-xs text-gray-400 mt-0.5 truncate">Note: {cond.note}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {isFhirPatient && status === 'idle' && members.length > 0 && (
            <p className="text-xs text-gray-400 text-center mt-4">
              Click a family member to expand &middot; Click a condition to edit
            </p>
          )}
        </div>

        {/* Add Family Members Card (free-text sync) */}
        {isFhirPatient && (
          <div className="bg-white rounded-lg shadow-sm border p-8 w-full max-w-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Add Family Members</h2>
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
                Family members synced
              </div>
            )}

            {syncStatus === 'resolving' && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
                Resolving SNOMED codes...
              </div>
            )}

            {syncStatus === 'syncing' && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
                Creating family members...
              </div>
            )}

            {/* Resolved entries preview */}
            {resolvedEntries.length > 0 && syncStatus !== 'idle' && syncStatus !== 'error' && (
              <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
                <p className="text-xs text-gray-500 mb-2">Resolved family history:</p>
                <div className="space-y-2">
                  {resolvedEntries.map((entry, i) => (
                    <div key={i}>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-400">{entry.relationshipTerm}</span>
                        <span className="text-gray-300">&rarr;</span>
                        {entry.relationship ? (
                          <>
                            <span className="font-mono text-blue-600">{entry.relationship.code}</span>
                            <span className="text-gray-700">{entry.relationship.display}</span>
                          </>
                        ) : (
                          <span className="text-orange-500">Unknown relationship</span>
                        )}
                      </div>
                      {entry.resolvedConditions.map((rc, j) => (
                        <div key={j} className="flex items-center gap-2 text-xs ml-4">
                          <span className="text-gray-400">{rc.term}</span>
                          <span className="text-gray-300">&rarr;</span>
                          {rc.code ? (
                            <>
                              <span className="font-mono text-blue-600">{rc.code.code}</span>
                              <span className="text-gray-700">{rc.code.description}</span>
                            </>
                          ) : (
                            <span className="text-orange-500">No SNOMED match (will use free text)</span>
                          )}
                        </div>
                      ))}
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
              data-placeholder="Type family history here (one member per line)&#10;e.g. father - heart attack age 65, deceased&#10;     mother - breast cancer, dm2"
            />
            <p className="text-xs text-gray-400 mt-2">
              One family member per line &middot; Format: relationship - conditions &middot; Common abbreviations are expanded automatically
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
