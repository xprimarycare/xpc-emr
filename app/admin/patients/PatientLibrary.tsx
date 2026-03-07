'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, UserPlus, Copy, X } from 'lucide-react';
import { AssignCaseDialog } from '@/components/dialogs/AssignCaseDialog';
import { DuplicatePatientDialog } from '@/components/dialogs/DuplicatePatientDialog';
import { AssignmentsTable } from './AssignmentsTable';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FhirPatientRow {
  fhirId: string;
  name: string;
  gender: string;
  birthDate: string;
  mrn: string;
  age: string;
}

interface DialogTarget {
  patientFhirId: string;
  patientName: string;
}

type TagCategory = 'conditions' | 'competencies' | 'contexts';

interface PatientTags {
  conditions: string[];
  competencies: string[];
  contexts: string[];
}

const TAG_COLORS: Record<TagCategory, { bg: string; text: string }> = {
  conditions: { bg: 'bg-blue-100', text: 'text-blue-800' },
  competencies: { bg: 'bg-green-100', text: 'text-green-800' },
  contexts: { bg: 'bg-purple-100', text: 'text-purple-800' },
};

// ---------------------------------------------------------------------------
// TagEditor — inline tag pills + always-visible input
// ---------------------------------------------------------------------------

function TagEditor({
  label,
  tags,
  colorKey,
  onChange,
}: {
  label: string;
  tags: string[];
  colorKey: TagCategory;
  onChange: (tags: string[]) => void;
}) {
  const [newTag, setNewTag] = useState('');
  const c = TAG_COLORS[colorKey];

  return (
    <div>
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5 items-center">
        {tags.map((tag) => (
          <span
            key={tag}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}
          >
            {tag}
            <button
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className={`${c.text} opacity-60 hover:opacity-100`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <form
          className="inline-flex items-center"
          onSubmit={(e) => {
            e.preventDefault();
            const v = newTag.trim();
            if (v && !tags.includes(v)) {
              onChange([...tags, v]);
            }
            setNewTag('');
          }}
        >
          <input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Add tag..."
            className="w-24 px-2 py-1 text-xs border-0 border-b border-gray-200 focus:border-indigo-400 focus:ring-0 bg-transparent placeholder-gray-300 focus:placeholder-gray-400"
          />
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseFhirBundle(bundle: any): FhirPatientRow[] {
  return (bundle?.entry || []).map((e: any) => {
    const r = e.resource;
    const nameEntry = r?.name?.[0];
    const given = nameEntry?.given?.join(' ') || '';
    const family = nameEntry?.family || '';
    const name = [given, family].filter(Boolean).join(' ') || 'Unknown';
    const mrn =
      r?.identifier?.find((i: any) =>
        i.type?.coding?.some((c: any) => c.code === 'MR')
      )?.value ||
      r?.identifier?.[0]?.value ||
      '';
    let age = '';
    if (r?.birthDate) {
      const birthYear = new Date(r.birthDate).getFullYear();
      age = String(new Date().getFullYear() - birthYear);
    }
    const gender = r?.gender
      ? r.gender.charAt(0).toUpperCase() + r.gender.slice(1)
      : '';
    return {
      fhirId: r.id,
      name,
      gender,
      birthDate: r?.birthDate || '',
      mrn,
      age,
    };
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PatientLibrary({ asPanel = false, onOpen }: { asPanel?: boolean; onOpen?: (patientFhirId: string, patientName: string) => void }) {
  // Tabs
  const [activeTab, setActiveTab] = useState<'cases' | 'assignments'>('cases');

  // Data
  const [patients, setPatients] = useState<FhirPatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialogs
  const [assignTarget, setAssignTarget] = useState<DialogTarget | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<DialogTarget | null>(
    null
  );

  // Detail drawer
  const [drawerPatient, setDrawerPatient] = useState<FhirPatientRow | null>(null);
  const [patientTagsMap, setPatientTagsMap] = useState<Record<string, PatientTags>>({});

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchTags = useCallback(async (patientFhirIds: string[]) => {
    if (patientFhirIds.length === 0) return;
    try {
      const res = await fetch(
        `/api/patient-tags?patientFhirIds=${patientFhirIds.join(',')}`
      );
      if (!res.ok) return;
      const grouped = await res.json();
      setPatientTagsMap((prev) => ({ ...prev, ...grouped }));
    } catch {
      // Silent — tags are supplementary
    }
  }, []);

  const fetchPatients = useCallback(async (nameQuery?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (nameQuery?.trim()) {
        params.set('name', nameQuery.trim());
      }
      const url = `/api/fhir/patient${params.toString() ? `?${params}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch patients');
      const bundle = await res.json();
      const parsed = parseFhirBundle(bundle);
      setPatients(parsed);
      fetchTags(parsed.map((p) => p.fhirId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load patients');
    } finally {
      setLoading(false);
    }
  }, [fetchTags]);

  // Save tags for a single category immediately (fire-and-forget)
  const updateTags = useCallback((pid: string, category: TagCategory, newTags: string[]) => {
    setPatientTagsMap((prev) => ({
      ...prev,
      [pid]: {
        ...(prev[pid] ?? { conditions: [], competencies: [], contexts: [] }),
        [category]: newTags,
      },
    }));
    // Persist immediately — only sends the changed category
    fetch('/api/patient-tags', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientFhirId: pid, tags: { [category]: newTags } }),
    }).catch((err) => console.error('Failed to save tags:', err));
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerPatient(null);
  }, []);

  // Fetch on mount and on debounced search change
  useEffect(() => {
    const timeout = setTimeout(() => fetchPatients(searchQuery), 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, fetchPatients]);

  // ---------------------------------------------------------------------------
  // Selection handlers
  // ---------------------------------------------------------------------------

  const togglePatient = (fhirId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fhirId)) next.delete(fhirId);
      else next.add(fhirId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === patients.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(patients.map((p) => p.fhirId)));
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className={asPanel ? '' : 'bg-white rounded-lg border overflow-hidden'}>
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-xl font-semibold text-gray-900">
          Patient Library
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Browse and manage all patients
        </p>
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-gray-200 flex items-center gap-6">
        <button
          onClick={() => setActiveTab('cases')}
          className={`-mb-px py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'cases'
              ? 'text-gray-900 border-gray-900'
              : 'text-gray-400 border-transparent hover:text-gray-600'
          }`}
        >
          Cases
        </button>
        <button
          onClick={() => setActiveTab('assignments')}
          className={`-mb-px py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'assignments'
              ? 'text-gray-900 border-gray-900'
              : 'text-gray-400 border-transparent hover:text-gray-600'
          }`}
        >
          Assignments
        </button>
      </div>

      {/* Assignments tab */}
      {activeTab === 'assignments' && <AssignmentsTable onOpen={onOpen} />}

      {/* Cases tab content */}
      {activeTab === 'cases' && <>

      {/* Search bar + Assign Selected */}
      <div className="px-6 pt-4 pb-4 flex items-center gap-3">
        <div className="relative flex-grow">
          <Search className="absolute inset-y-0 left-3 my-auto h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search patients by name..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-gray-400 bg-white"
          />
        </div>
        <button
          disabled={selectedIds.size === 0}
          onClick={() => {
            const first = patients.find((p) => selectedIds.has(p.fhirId));
            if (first) {
              setAssignTarget({
                patientFhirId: first.fhirId,
                patientName: first.name,
              });
            }
          }}
          className="flex-shrink-0 flex items-center gap-1.5 text-sm px-3 py-2 font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-md bg-white"
        >
          <UserPlus className="h-4 w-4" />
          Assign{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
        </button>
      </div>

      {/* Data Table */}
      <div className="p-6 overflow-x-auto">
          {loading && (
            <div className="text-center py-12 text-sm text-gray-400">
              Loading patients...
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-sm text-red-600">
              {error}
            </div>
          )}

          {!loading && !error && patients.length === 0 && (
            <div className="text-center py-12 text-sm text-gray-400">
              No patients found
            </div>
          )}

          {!loading && !error && patients.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={
                          selectedIds.size === patients.length &&
                          patients.length > 0
                        }
                        onChange={toggleSelectAll}
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                      Patient
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Condition
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Competency
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Context
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {patients.map((p) => (
                    <tr key={p.fhirId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(p.fhirId)}
                          onChange={() => togglePatient(p.fhirId)}
                          className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setDrawerPatient(p)}
                          className="text-left"
                        >
                          <div className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">
                            {p.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {[p.age, p.gender?.charAt(0)]
                              .filter(Boolean)
                              .join(' ')}
                          </div>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(patientTagsMap[p.fhirId]?.conditions ?? []).map((t) => (
                            <span key={t} className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">{t}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(patientTagsMap[p.fhirId]?.competencies ?? []).map((t) => (
                            <span key={t} className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">{t}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(patientTagsMap[p.fhirId]?.contexts ?? []).map((t) => (
                            <span key={t} className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-800">{t}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() =>
                              setAssignTarget({
                                patientFhirId: p.fhirId,
                                patientName: p.name,
                              })
                            }
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                            title="Assign"
                          >
                            <UserPlus className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() =>
                              setDuplicateTarget({
                                patientFhirId: p.fhirId,
                                patientName: p.name,
                              })
                            }
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded"
                            title="Duplicate"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Patient count */}
          {!loading && !error && patients.length > 0 && (
            <div className="mt-3 text-xs text-gray-400">
              {patients.length} patient{patients.length !== 1 ? 's' : ''}
            </div>
          )}
      </div>

      {/* Dialogs */}
      {assignTarget && (
        <AssignCaseDialog
          onClose={() => {
            setAssignTarget(null);
          }}
          patientFhirId={assignTarget.patientFhirId}
          patientName={assignTarget.patientName}
        />
      )}
      {duplicateTarget && (
        <DuplicatePatientDialog
          onClose={() => {
            setDuplicateTarget(null);
            fetchPatients(searchQuery);
          }}
          patientFhirId={duplicateTarget.patientFhirId}
          patientName={duplicateTarget.patientName}
        />
      )}

      {/* Detail Drawer */}
      {drawerPatient && (
        <div
          className="fixed inset-0 z-40"
          onClick={closeDrawer}
        >
          <div className="absolute inset-0 bg-black/20" />
          <div
            className="absolute top-0 right-0 h-full w-80 bg-white border-l shadow-xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-base font-semibold text-gray-900">
                    {drawerPatient.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {[drawerPatient.age, drawerPatient.gender?.charAt(0)]
                      .filter(Boolean)
                      .join(' ')}
                  </div>
                  <div className="flex items-center gap-1 mt-1.5">
                    <button
                      onClick={() => {
                        const target = { patientFhirId: drawerPatient.fhirId, patientName: drawerPatient.name };
                        closeDrawer();
                        setAssignTarget(target);
                      }}
                      className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                      title="Assign"
                    >
                      <UserPlus className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        const target = { patientFhirId: drawerPatient.fhirId, patientName: drawerPatient.name };
                        closeDrawer();
                        setDuplicateTarget(target);
                      }}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded"
                      title="Duplicate"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <button
                  onClick={closeDrawer}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <hr />
              <TagEditor
                label="Condition"
                tags={patientTagsMap[drawerPatient.fhirId]?.conditions ?? []}
                colorKey="conditions"
                onChange={(tags) => updateTags(drawerPatient.fhirId, 'conditions', tags)}
              />
              <TagEditor
                label="Competency"
                tags={patientTagsMap[drawerPatient.fhirId]?.competencies ?? []}
                colorKey="competencies"
                onChange={(tags) => updateTags(drawerPatient.fhirId, 'competencies', tags)}
              />
              <TagEditor
                label="Context"
                tags={patientTagsMap[drawerPatient.fhirId]?.contexts ?? []}
                colorKey="contexts"
                onChange={(tags) => updateTags(drawerPatient.fhirId, 'contexts', tags)}
              />
              <button
                onClick={closeDrawer}
                className="w-full px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      </> /* end cases tab */}
    </div>
  );
}
