'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useEditor } from '@/lib/context/EditorContext';
import { useAuth } from '@/lib/context/AuthContext';
import { usePatient } from '@/lib/context/PatientContext';

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
  signedEncounterCount: number;
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
  const { addPatient, setActivePatientId, patients } = usePatient();

  const isAdmin = user?.role === 'admin';

  const [view, setView] = useState<CaseLibraryView>(
    isAdmin ? { type: 'users' } : { type: 'user-patients', userId: user?.id || '', userName: 'My Cases' }
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

  // Reset view when panel opens or role changes
  useEffect(() => {
    if (leftPanelMode === 'caseLibrary') {
      if (isAdmin) {
        setView({ type: 'users' });
        setAdminTab('users');
      } else if (user?.id) {
        setView({ type: 'user-patients', userId: user.id, userName: 'My Cases' });
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

  if (leftPanelMode !== 'caseLibrary') {
    return null;
  }

  const formatDate = (iso?: string) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/New_York',
      });
    } catch {
      return iso;
    }
  };

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
        setView({ type: 'user-patients', userId: user.id, userName: 'My Cases' });
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

  const handleEncounterClick = async (patientFhirId: string, encounterFhirId?: string) => {
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
      // Fetch patient and open them
      try {
        const res = await fetch(`/api/fhir/encounter?patient=${patientFhirId}`);
        if (res.ok) {
          // Just open via addPatient with minimal data — the full load happens in existing flow
          addPatient({
            id: `fhir-${patientFhirId}`,
            name: 'Loading...',
            mrn: '',
            dob: '',
            sex: '',
            fhirId: patientFhirId,
            tabs: [],
          });
          // Once tabs load, navigate to the encounter tab
          if (encounterFhirId) {
            setTimeout(() => {
              const patient = patients.find((p) => p.fhirId === patientFhirId);
              const tab = patient?.tabs.find((t) => t.encounterFhirId === encounterFhirId);
              if (tab) setActiveTabId(tab.id);
            }, 500);
          }
        }
      } catch {
        // Fallback: still try to open
        addPatient({
          id: `fhir-${patientFhirId}`,
          name: 'Patient',
          mrn: '',
          dob: '',
          sex: '',
          fhirId: patientFhirId,
          tabs: [],
        });
      }
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
    <div className="flex-1 overflow-y-auto">
      {view.type === 'user-patients' && isAdmin && renderBackButton(view.userName)}
      {isLoading && renderLoading()}
      {!isLoading && error && renderError()}
      {!isLoading && !error && userPatients.length === 0 && renderEmpty('No patients assigned')}
      {!isLoading &&
        !error &&
        userPatients.map((p) => (
          <button
            key={p.patientFhirId}
            onClick={() =>
              handleNavigate({
                type: 'patient-encounters',
                patientFhirId: p.patientFhirId,
                patientName: p.patientName,
              })
            }
            className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium truncate">{p.patientName}</span>
              {p.signedEncounterCount > 0 && (
                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded shrink-0 ml-2">
                  {p.signedEncounterCount} signed
                </span>
              )}
            </div>
          </button>
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
                handleEncounterClick(view.patientFhirId, e.encounterFhirId);
              }
            }}
            className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100"
          >
            <div className="text-sm font-medium">
              {formatDate(e.date)} &middot; {e.classDisplay}
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
            onClick={() => handleEncounterClick(a.patientFhirId, a.encounterFhirId)}
            className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100"
          >
            <div className="text-sm font-medium truncate">{a.patientName}</div>
            <div className="text-xs text-gray-500">{a.classDisplay}</div>
            <div className="text-xs text-gray-500">{a.signedBy || 'Unknown'}</div>
            <div className="text-xs text-gray-400">{formatDate(a.signedAt)}</div>
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
    <div className="w-72 border-r bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b">
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
          <div className="text-sm font-medium text-gray-900 py-1.5">My Cases</div>
        )}
      </div>

      {/* Content */}
      {renderContent()}
    </div>
  );
}
