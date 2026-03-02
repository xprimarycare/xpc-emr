'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePatient } from '@/lib/context/PatientContext';
import { AppCareTeamMember } from '@/lib/types/care-team';
import {
  searchFhirCareTeamMembers,
  upsertFhirCareTeamMember,
  deleteFhirCareTeamMember,
  createFhirCareTeamMember,
  batchResolveCareTeamMembers,
  ResolvedCareTeamEntry,
} from '@/lib/services/fhir-care-team-service';

type SaveStatus = 'idle' | 'loading' | 'saving' | 'success' | 'error';
type SyncStatus = 'idle' | 'resolving' | 'syncing' | 'success' | 'error';

export function CareTeamTab({ refreshKey }: { refreshKey?: number }) {
  const { activePatient } = usePatient();
  const isFhirPatient = !!activePatient?.fhirId;
  const editorRef = useRef<HTMLDivElement>(null);

  const [members, setMembers] = useState<AppCareTeamMember[]>([]);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AppCareTeamMember>>({});

  // Sync state
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [resolvedEntries, setResolvedEntries] = useState<ResolvedCareTeamEntry[]>([]);

  // Fetch care team members when FHIR patient changes
  useEffect(() => {
    if (!isFhirPatient || !activePatient?.fhirId) {
      setMembers([]);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setError(null);
    searchFhirCareTeamMembers(activePatient.fhirId).then((result) => {
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

  const handleEdit = (member: AppCareTeamMember) => {
    setEditingId(member.id);
    setEditForm({ ...member });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async (member: AppCareTeamMember) => {
    if (!activePatient?.fhirId) return;

    const updated = { ...member, ...editForm } as AppCareTeamMember;
    const previousMembers = members;

    setMembers((prev) =>
      prev.map((m) => (m.id === member.id ? updated : m))
    );
    setEditingId(null);
    setEditForm({});

    setStatus('saving');
    setError(null);
    const result = await upsertFhirCareTeamMember(updated, activePatient.fhirId);
    if (result.success) {
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } else {
      setMembers(previousMembers);
      setError(result.error || 'Failed to save');
      setStatus('error');
    }
  };

  const handleDelete = async (member: AppCareTeamMember) => {
    if (!member.fhirId) return;

    const previousMembers = members;
    setMembers((prev) => prev.filter((m) => m.id !== member.id));
    setEditingId(null);
    setEditForm({});

    setStatus('saving');
    setError(null);
    const result = await deleteFhirCareTeamMember(member.fhirId);
    if (result.success) {
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } else {
      setMembers(previousMembers);
      setError(result.error || 'Failed to delete');
      setStatus('error');
    }
  };

  const handleSyncToMedplum = async () => {
    if (!activePatient?.fhirId) return;

    const text = editorRef.current?.innerText || '';
    if (!text.trim()) {
      setSyncError('Type some care team members before syncing.');
      setSyncStatus('error');
      return;
    }

    // Step 1: Resolve all roles to SNOMED codes
    setSyncStatus('resolving');
    setSyncError(null);
    setResolvedEntries([]);

    const resolved = await batchResolveCareTeamMembers(text);
    if (resolved.entries.length === 0) {
      setSyncError(resolved.error || 'No care team members could be parsed from the text.');
      setSyncStatus('error');
      return;
    }

    setResolvedEntries(resolved.entries);

    // Step 2: Create each as a CareTeam resource in Medplum
    setSyncStatus('syncing');
    let allSuccess = true;

    for (const entry of resolved.entries) {
      const newMember: AppCareTeamMember = {
        id: `new-${Date.now()}-${Math.random()}`,
        fhirId: '',
        name: entry.name,
        role: entry.role,
        status: 'active',
        coding: entry.code ? {
          system: entry.code.system,
          code: entry.code.code,
          display: entry.code.description,
        } : undefined,
      };

      const result = await createFhirCareTeamMember(newMember, activePatient.fhirId);
      if (!result.success) {
        setSyncError(result.error || `Failed to create care team member: ${entry.name}`);
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

      // Re-fetch members list from Medplum
      const refreshed = await searchFhirCareTeamMembers(activePatient.fhirId);
      if (!refreshed.error) {
        setMembers(refreshed.members);
      }
    } else {
      setSyncStatus('error');
    }
  };

  if (!activePatient) return null;

  return (
    <div className="py-8 px-8">
      <div className="flex flex-col items-center gap-6">

        {/* ── Structured Care Team Card ── */}
        <div className="bg-white rounded-lg shadow-sm border p-8 w-full max-w-xl">
          <h2 className="text-xl font-semibold mb-6">Care Team</h2>

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
              Loading care team...
            </div>
          )}

          {/* Empty state */}
          {status !== 'loading' && members.length === 0 && status !== 'error' && (
            <div className="text-gray-400 text-sm text-center py-8">
              No care team members found in Medplum
            </div>
          )}

          {/* Members list */}
          {members.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 mb-2">
                {members.length} member{members.length !== 1 ? 's' : ''} from Medplum
              </p>
              {members.map((member) => (
                <div
                  key={member.id}
                  className="p-4 border border-gray-200 rounded-lg"
                >
                  {editingId === member.id ? (
                    /* Edit mode */
                    <div className="space-y-3">
                      <input
                        className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={editForm.name || ''}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        placeholder="Provider name"
                      />
                      <input
                        className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={editForm.role || ''}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                        placeholder="Role / Specialty (e.g., Cardiologist)"
                      />
                      {member.coding?.code && (
                        <p className="text-xs text-gray-500">
                          SNOMED: {member.coding.code}{member.coding.display ? ` \u2014 ${member.coding.display}` : ''}
                        </p>
                      )}
                      <select
                        className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        value={editForm.status || member.status}
                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value as AppCareTeamMember['status'] })}
                      >
                        <option value="active">Active</option>
                        <option value="proposed">Proposed</option>
                        <option value="suspended">Suspended</option>
                        <option value="inactive">Inactive</option>
                      </select>
                      <input
                        className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={editForm.note || ''}
                        onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                        placeholder="Note"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSave(member)}
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
                          onClick={() => handleDelete(member)}
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
                      onClick={() => handleEdit(member)}
                    >
                      <div>
                        <p className="font-medium text-sm text-gray-900">{member.name}</p>
                        {member.role && (
                          <p className="text-xs text-gray-500 mt-1">{member.role}</p>
                        )}
                        {member.note && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">Note: {member.note}</p>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        member.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : member.status === 'suspended'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-500'
                      }`}>
                        {member.status}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {isFhirPatient && status === 'idle' && members.length > 0 && (
            <p className="text-xs text-gray-400 text-center mt-4">
              Click a member to edit · Changes will be saved to Medplum
            </p>
          )}
        </div>

        {/* ── Add Care Team Members Card (free-text sync area) ── */}
        {isFhirPatient && (
          <div className="bg-white rounded-lg shadow-sm border p-8 w-full max-w-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Add Care Team Members</h2>
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
                Care team members synced to Medplum
              </div>
            )}

            {syncStatus === 'resolving' && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
                Resolving specialty codes...
              </div>
            )}

            {syncStatus === 'syncing' && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
                Creating care team members in Medplum...
              </div>
            )}

            {/* Resolved entries preview */}
            {resolvedEntries.length > 0 && syncStatus !== 'idle' && syncStatus !== 'error' && (
              <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
                <p className="text-xs text-gray-500 mb-2">Resolved members:</p>
                <div className="space-y-1">
                  {resolvedEntries.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="font-medium text-gray-700">{entry.name}</span>
                      {entry.role && (
                        <span className="text-gray-500">{entry.role}</span>
                      )}
                      <span className="text-gray-300">&rarr;</span>
                      {entry.code ? (
                        <>
                          <span className="font-mono text-blue-600">{entry.code.code}</span>
                          <span className="text-gray-700">{entry.code.description}</span>
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
              data-placeholder="Type care team members (e.g. Dr. Smith - Cardiology, Dr. Jones - ENT) then click Sync..."
            />
            <p className="text-xs text-gray-400 mt-2">
              Format: &quot;Provider Name - Role/Specialty&quot; · Separate with commas or newlines · Abbreviations auto-expand (PCP, GI, ENT, etc.)
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
