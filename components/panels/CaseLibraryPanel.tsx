'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, UserPlus, Copy, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { useEditor } from '@/lib/context/EditorContext';
import { useAuth } from '@/lib/context/AuthContext';
import { usePatient } from '@/lib/context/PatientContext';
import { AssignCaseDialog } from '@/components/dialogs/AssignCaseDialog';
import { DuplicatePatientDialog } from '@/components/dialogs/DuplicatePatientDialog';
import { STATUS_BADGE, CaseStatus, STATUS_ORDER, formatDateTime } from '@/lib/constants/case-status';
import type { CaseStatusValue } from '@/lib/constants/case-status';
import { createDefaultTabs } from '@/lib/data/default-tabs';
import { PatientLibrary } from '@/app/admin/patients/PatientLibrary';

type CaseLibraryView =
  | { type: 'users' }
  | { type: 'user-patients'; userId: string; userName: string }
  | { type: 'patient-encounters'; patientFhirId: string; patientName: string }
  | { type: 'recent-activity' };

interface UserRow {
  id: string;
  name: string | null;
  email: string;
  institution: string | null;
  patientCount: number;
  noteCount: number;
}

interface PatientRow {
  patientFhirId: string;
  patientName: string;
  patientAge?: string;
  patientSex?: string;
  signedEncounterCount: number;
  encounterType?: string;
  notePreview?: string;
  status?: string;
  encounterFhirId?: string;
}

interface EncounterRow {
  encounterFhirId: string;
  date: string;
  classDisplay: string;
  signedAt?: string;
  signedBy?: string;
  notePreview?: string;
}

interface ActivityRow {
  encounterFhirId: string;
  patientFhirId: string;
  patientName: string;
  signedAt?: string;
  signedBy?: string;
  classDisplay: string;
}

export function CaseLibraryPanel() {
  const { leftPanelMode, toggleLeftPanel, setActiveTabId } = useEditor();
  const { user } = useAuth();
  const { addPatient, setActivePatientId, updatePatient, patients } = usePatient();

  const isAdmin = user?.role === 'admin';

  const [view, setView] = useState<CaseLibraryView>(
    isAdmin ? { type: 'users' } : { type: 'user-patients', userId: user?.id || '', userName: 'My Patients' }
  );
  const [adminTab, setAdminTab] = useState<'users' | 'recent'>('users');
  // Track the user we drilled into so back from patient-encounters returns to their patients
  const [parentUser, setParentUser] = useState<{ userId: string; userName: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userPatients, setUserPatients] = useState<PatientRow[]>([]);
  const [encounters, setEncounters] = useState<EncounterRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);

  // Dialog states
  const [assignTarget, setAssignTarget] = useState<{ patientFhirId: string; patientName: string; encounterFhirId?: string } | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<{ patientFhirId: string; patientName: string } | null>(null);

  // Reset view when panel opens or role changes
  useEffect(() => {
    if (leftPanelMode === 'caseLibrary') {
      if (isAdmin) {
        setView({ type: 'users' });
        setAdminTab('users');
      } else if (user?.id) {
        setView({ type: 'user-patients', userId: user.id, userName: 'My Patients' });
      }
    }
  }, [leftPanelMode, isAdmin, user?.id]);

  const fetchData = useCallback(async (currentView: CaseLibraryView) => {
    setIsLoading(true);
    setError(null);

    try {
      let url = '/api/case-library?';
      switch (currentView.type) {
        case 'users':
          url += 'view=users';
          break;
        case 'user-patients':
          url += `view=user-patients&userId=${currentView.userId}`;
          break;
        case 'patient-encounters':
          url += `view=patient-encounters&patientFhirId=${currentView.patientFhirId}`;
          break;
        case 'recent-activity':
          url += 'view=recent-activity';
          break;
      }

      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }

      const data = await res.json();

      switch (currentView.type) {
        case 'users':
          setUsers(data);
          break;
        case 'user-patients':
          setUserPatients(data);
          break;
        case 'patient-encounters':
          setEncounters(data);
          break;
        case 'recent-activity':
          setActivity(data);
          break;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch data when view changes
  useEffect(() => {
    if (leftPanelMode !== 'caseLibrary') return;
    fetchData(view);
  }, [view, leftPanelMode, fetchData]);

  const [statusSort, setStatusSort] = useState<'asc' | 'desc' | null>(null);

  const filteredPatients = useMemo(() => {
    if (!statusSort) return userPatients;
    return [...userPatients].sort((a, b) => {
      const ao = STATUS_ORDER[a.status ?? ''] ?? 99;
      const bo = STATUS_ORDER[b.status ?? ''] ?? 99;
      return statusSort === 'asc' ? ao - bo : bo - ao;
    });
  }, [userPatients, statusSort]);

  if (leftPanelMode !== 'caseLibrary') {
    return null;
  }

  if (isAdmin) {
    return (
      <div className="flex-1 border-r bg-white overflow-y-auto">
        <PatientLibrary asPanel />
      </div>
    );
  }

  const handleNavigate = (nextView: CaseLibraryView) => {
    // Track parent user when drilling from user-patients to patient-encounters
    if (nextView.type === 'patient-encounters' && view.type === 'user-patients') {
      setParentUser({ userId: view.userId, userName: view.userName });
    }
    setView(nextView);
  };

  const handleBack = () => {
    if (view.type === 'patient-encounters') {
      if (parentUser) {
        setView({ type: 'user-patients', userId: parentUser.userId, userName: parentUser.userName });
      } else if (!isAdmin && user?.id) {
        setView({ type: 'user-patients', userId: user.id, userName: 'My Patients' });
      } else {
        setView({ type: 'users' });
      }
    } else if (view.type === 'user-patients' && isAdmin) {
      setParentUser(null);
      setView({ type: 'users' });
    }
  };

  const handleAdminTabChange = (tab: 'users' | 'recent') => {
    setAdminTab(tab);
    if (tab === 'users') {
      setView({ type: 'users' });
    } else {
      setView({ type: 'recent-activity' });
    }
  };

  const handlePatientClick = async (patientFhirId: string, patientStatus?: string) => {
    // For clinicians: auto-transition from waiting_room to in_progress on click
    if (!isAdmin && patientStatus === CaseStatus.WAITING_ROOM) {
      try {
        await fetch('/api/user/patients', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patientFhirId, status: CaseStatus.IN_PROGRESS }),
        });
        // Update local state
        setUserPatients((prev) =>
          prev.map((p) =>
            p.patientFhirId === patientFhirId ? { ...p, status: CaseStatus.IN_PROGRESS } : p
          )
        );
      } catch {
        // Continue even if status update fails
      }
    }
  };

  const handleEncounterClick = async (patientFhirId: string, encounterFhirId?: string, patientName?: string) => {
    // Check if patient is already open
    const existing = patients.find((p) => p.fhirId === patientFhirId);
    if (existing) {
      setActivePatientId(existing.id);
      // Navigate to the specific encounter tab if provided
      if (encounterFhirId) {
        const tab = existing.tabs.find((t) => t.encounterFhirId === encounterFhirId);
        if (tab) setActiveTabId(tab.id);
      }
    } else {
      const patientId = `fhir-${patientFhirId}`;
      const name = patientName || 'Patient';
      addPatient({
        id: patientId,
        name,
        mrn: '',
        dob: '',
        sex: '',
        fhirId: patientFhirId,
        tabs: createDefaultTabs({ name, mrn: '', dob: '', sex: '' }),
      });

      // Fetch full patient details to fill in demographics
      fetch(`/api/fhir/patient?id=${patientFhirId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((bundle) => {
          const resource = bundle?.entry?.[0]?.resource;
          if (resource) {
            const fhirName = resource.name?.[0];
            const given = fhirName?.given?.join(' ') || '';
            const family = fhirName?.family || '';
            const fullName = [given, family].filter(Boolean).join(' ');
            updatePatient(patientId, {
              name: fullName || name,
              dob: resource.birthDate || '',
              sex: resource.gender || '',
            });
          }
        })
        .catch(() => {});
    }
    toggleLeftPanel('sidebar');
  };

  // --- Render helpers ---

  const renderLoading = () => (
    <div className="p-4 text-center text-sm text-gray-500">Loading...</div>
  );

  const renderError = () => (
    <div className="p-3 text-sm text-red-600">{error}</div>
  );

  const renderEmpty = (message: string) => (
    <div className="p-4 text-center text-sm text-gray-500">{message}</div>
  );

  const renderBackButton = (label: string) => (
    <button
      onClick={handleBack}
      className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 w-full border-b"
    >
      <ChevronLeft size={14} />
      <span className="truncate">{label}</span>
    </button>
  );

  const renderStatusBadge = (status?: string) => {
    if (!status) return null;
    const badge = STATUS_BADGE[status as CaseStatusValue];
    if (!badge) return null;
    return (
      <span className={`text-xs ${badge.bg} ${badge.text} px-1.5 py-0.5 rounded shrink-0 ml-1`}>
        {badge.label}
      </span>
    );
  };

  const renderUsersList = () => (
    <div className="flex-1 overflow-y-auto">
      {isLoading && renderLoading()}
      {!isLoading && error && renderError()}
      {!isLoading && !error && users.length === 0 && renderEmpty('No users found')}
      {!isLoading &&
        !error &&
        users.map((u) => (
          <button
            key={u.id}
            onClick={() =>
              handleNavigate({
                type: 'user-patients',
                userId: u.id,
                userName: u.name || u.email,
              })
            }
            className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100"
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <span className="text-sm font-medium truncate block">
                  {u.name || u.email}
                </span>
                {u.institution && (
                  <span className="text-xs text-gray-500 truncate block">{u.institution}</span>
                )}
              </div>
              <div className="flex flex-col items-end gap-0.5 shrink-0 ml-2">
                <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                  {u.patientCount} {u.patientCount === 1 ? 'case' : 'cases'}
                </span>
                <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                  {u.noteCount} {u.noteCount === 1 ? 'note' : 'notes'}
                </span>
              </div>
            </div>
          </button>
        ))}
    </div>
  );

  const renderUserPatients = () => (
    <div className={`flex-1 overflow-y-auto ${!isAdmin ? 'px-6 py-4' : ''}`}>
      {view.type === 'user-patients' && isAdmin && renderBackButton(view.userName)}

      {isLoading && renderLoading()}
      {!isLoading && error && renderError()}
      {!isLoading && !error && filteredPatients.length === 0 && renderEmpty('No patients assigned')}
      {!isLoading && !error && !isAdmin && filteredPatients.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Open</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-36">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                  <button
                    onClick={() =>
                      setStatusSort((prev) =>
                        prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc'
                      )
                    }
                    className="flex items-center gap-1 uppercase tracking-wider hover:text-gray-700"
                  >
                    Status
                    {statusSort === 'asc'
                      ? <ArrowUp className="h-3 w-3 text-gray-400" />
                      : statusSort === 'desc'
                      ? <ArrowDown className="h-3 w-3 text-gray-400" />
                      : <ArrowUpDown className="h-3 w-3 text-gray-300" />}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preview</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPatients.map((p) => {
                const demo = [p.patientAge, p.patientSex].filter(Boolean).join(' ');
                const badge = p.status ? STATUS_BADGE[p.status as CaseStatusValue] : null;
                return (
                  <tr key={p.patientFhirId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={async () => {
                          await handlePatientClick(p.patientFhirId, p.status);
                          handleEncounterClick(p.patientFhirId, p.encounterFhirId, p.patientName);
                        }}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                      >
                        Open
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-gray-900">{p.patientName}</div>
                      {demo && <div className="text-sm text-gray-500">{demo}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {badge && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      <div className="line-clamp-2">
                        {p.notePreview || <span className="text-gray-300 italic">No notes yet</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!isLoading &&
        !error &&
        isAdmin &&
        filteredPatients.map((p) => (
          <div
            key={p.patientFhirId}
            className="flex items-center border-b border-gray-100 hover:bg-blue-50"
          >
            <button
              onClick={async () => {
                await handlePatientClick(p.patientFhirId, p.status);
                handleNavigate({
                  type: 'patient-encounters',
                  patientFhirId: p.patientFhirId,
                  patientName: p.patientName,
                });
              }}
              className="flex-1 text-left px-3 py-2 min-w-0"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium truncate">{p.patientName}</span>
                <div className="flex items-center shrink-0 ml-1">
                  {p.signedEncounterCount > 0 && (
                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                      {p.signedEncounterCount} signed
                    </span>
                  )}
                </div>
              </div>
            </button>

            {/* Admin action buttons */}
            {isAdmin && (
              <div className="flex items-center gap-0.5 pr-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setAssignTarget({
                      patientFhirId: p.patientFhirId,
                      patientName: p.patientName,
                      encounterFhirId: p.encounterFhirId,
                    });
                  }}
                  className="p-1 text-gray-400 hover:text-blue-600 rounded"
                  title="Assign to clinicians"
                >
                  <UserPlus size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDuplicateTarget({
                      patientFhirId: p.patientFhirId,
                      patientName: p.patientName,
                    });
                  }}
                  className="p-1 text-gray-400 hover:text-purple-600 rounded"
                  title="Duplicate patient"
                >
                  <Copy size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
    </div>
  );

  const renderPatientEncounters = () => (
    <div className="flex-1 overflow-y-auto">
      {view.type === 'patient-encounters' && renderBackButton(view.patientName)}
      {isLoading && renderLoading()}
      {!isLoading && error && renderError()}
      {!isLoading && !error && encounters.length === 0 && renderEmpty('No signed encounters')}
      {!isLoading &&
        !error &&
        encounters.map((e) => (
          <button
            key={e.encounterFhirId}
            onClick={() => {
              if (view.type === 'patient-encounters') {
                handleEncounterClick(view.patientFhirId, e.encounterFhirId, view.patientName);
              }
            }}
            className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100"
          >
            <div className="text-sm font-medium">
              {formatDateTime(e.date)} &middot; {e.classDisplay}
            </div>
            {e.notePreview && (
              <div className="text-xs text-gray-400 truncate mt-0.5">{e.notePreview}</div>
            )}
          </button>
        ))}
    </div>
  );

  const renderRecentActivity = () => (
    <div className="flex-1 overflow-y-auto">
      {isLoading && renderLoading()}
      {!isLoading && error && renderError()}
      {!isLoading && !error && activity.length === 0 && renderEmpty('No recent activity')}
      {!isLoading &&
        !error &&
        activity.map((a) => (
          <button
            key={a.encounterFhirId}
            onClick={() => handleEncounterClick(a.patientFhirId, a.encounterFhirId, a.patientName)}
            className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100"
          >
            <div className="text-sm font-medium truncate">{a.patientName}</div>
            <div className="text-xs text-gray-500">{a.classDisplay}</div>
            <div className="text-xs text-gray-500">{a.signedBy || 'Unknown'}</div>
            <div className="text-xs text-gray-400">{formatDateTime(a.signedAt)}</div>
          </button>
        ))}
    </div>
  );

  const renderContent = () => {
    switch (view.type) {
      case 'users':
        return renderUsersList();
      case 'user-patients':
        return renderUserPatients();
      case 'patient-encounters':
        return renderPatientEncounters();
      case 'recent-activity':
        return renderRecentActivity();
    }
  };

  return (
    <div className="flex-1 border-r bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className={`px-3 py-2 border-b ${!isAdmin ? 'px-6' : ''}`}>
        {isAdmin ? (
          <div className="flex gap-1">
            <button
              onClick={() => handleAdminTabChange('users')}
              className={`px-3 py-1.5 text-sm rounded ${
                adminTab === 'users'
                  ? 'bg-gray-100 font-medium text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Users
            </button>
            <button
              onClick={() => handleAdminTabChange('recent')}
              className={`px-3 py-1.5 text-sm rounded ${
                adminTab === 'recent'
                  ? 'bg-gray-100 font-medium text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Recent
            </button>
          </div>
        ) : (
          <div className="text-lg font-semibold text-gray-900 py-1.5">My Patients</div>
        )}
      </div>

      {/* Content */}
      {renderContent()}

      {/* Dialogs */}
      {assignTarget && (
        <AssignCaseDialog
          onClose={() => {
            setAssignTarget(null);
            fetchData(view);
          }}
          patientFhirId={assignTarget.patientFhirId}
          patientName={assignTarget.patientName}
          encounterFhirId={assignTarget.encounterFhirId}
        />
      )}
      {duplicateTarget && (
        <DuplicatePatientDialog
          onClose={() => {
            setDuplicateTarget(null);
            fetchData(view);
          }}
          patientFhirId={duplicateTarget.patientFhirId}
          patientName={duplicateTarget.patientName}
        />
      )}
    </div>
  );
}
