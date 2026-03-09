'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Mic } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { usePatient } from '@/lib/context/PatientContext';
import { useEditor } from '@/lib/context/EditorContext';
import { AppEncounter, ENCOUNTER_CLASS_OPTIONS } from '@/lib/types/encounter';
import {
  createFhirEncounter,
  updateFhirEncounter,
} from '@/lib/services/fhir-encounter-service';
import { useSidebar } from '@/lib/context/SidebarContext';
import { useWhisper } from '@/lib/hooks/useWhisper';

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

export function EncounterMetadataBar() {
  const { user } = useAuth();
  const { activePatient, updateTabProperties } = usePatient();
  const { activeTabId, tabContent } = useEditor();

  const { rightPanelOpen, rightPanelType, setRightPanelType, setChartReviewContent } = useSidebar();

  const handleTranscription = useCallback((text: string) => {
    window.dispatchEvent(new CustomEvent('insertTemplate', { detail: text }));
  }, []);

  const {
    isModelLoading,
    isRecording,
    isTranscribing,
    progress,
    toggleRecording,
  } = useWhisper(handleTranscription);

  const activeTab = activePatient?.tabs.find(t => t.id === activeTabId);

  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [encounterClass, setEncounterClass] = useState<AppEncounter['classCode']>('AMB');
  const [encounterDate, setEncounterDate] = useState(
    activeTab?.visitDate || new Date().toISOString().split('T')[0]
  );
  const [encounterFhirId, setEncounterFhirId] = useState<string | undefined>();
  const [noteFhirId, setNoteFhirId] = useState<string | undefined>();
  const [isSigned, setIsSigned] = useState(false);
  const [signedAt, setSignedAt] = useState<string | undefined>();
  const [signedBy, setSignedBy] = useState<string | undefined>();

  // Initialize state from the tab when switching tabs
  useEffect(() => {
    setEncounterFhirId(activeTab?.encounterFhirId);
    setNoteFhirId(activeTab?.noteFhirId);
    setIsSigned(!!activeTab?.isSigned);
    setSignedAt(activeTab?.signedAt);
    setSignedBy(activeTab?.signedBy);
    setStatus('idle');
    setError(null);
    if (activeTab?.visitDate) {
      setEncounterDate(activeTab.visitDate);
    }
  }, [activeTabId, activeTab?.visitDate, activeTab?.encounterFhirId, activeTab?.noteFhirId, activeTab?.isSigned, activeTab?.signedAt, activeTab?.signedBy]);

  /** Strip HTML tags to get plain text for the ClinicalImpression.
   * Note: content is app-controlled from PatientContext, not external user HTML. */
  function stripHtml(htmlString: string): string {
    const tmp = document.createElement('div');
    // Content is app-controlled from PatientContext (same pattern as existing EncounterTab)
    tmp.innerHTML = htmlString;
    return tmp.textContent || tmp.innerText || '';
  }

  /** Build an AppEncounter from current state */
  function buildAppEncounter(overrides?: Partial<AppEncounter>): AppEncounter | null {
    if (!activePatient?.fhirId || !activeTabId) return null;

    const htmlContent = tabContent[activeTabId] || activeTab?.content || '';
    const plainText = stripHtml(htmlContent);

    if (!plainText.trim()) {
      setError('Please write some encounter notes before saving.');
      setStatus('error');
      return null;
    }

    const classOption = ENCOUNTER_CLASS_OPTIONS.find(c => c.code === encounterClass);

    return {
      id: activeTabId,
      encounterFhirId,
      noteFhirId,
      status: 'finished',
      classCode: encounterClass,
      classDisplay: classOption?.display || encounterClass,
      date: new Date(encounterDate + 'T00:00:00').toISOString(),
      noteText: plainText,
      patientFhirId: activePatient.fhirId,
      ...overrides,
    };
  }

  /** Persist (create or update) an AppEncounter to EMR. Returns result or null on validation failure. */
  async function persistEncounter(appEncounter: AppEncounter) {
    setStatus('saving');
    setError(null);

    if (appEncounter.encounterFhirId) {
      const result = await updateFhirEncounter(appEncounter);
      if (result.success) {
        return result;
      } else {
        setError(result.error || 'Failed to update encounter');
        setStatus('error');
        return null;
      }
    } else {
      const result = await createFhirEncounter(appEncounter);
      if (result.success) {
        setEncounterFhirId(result.encounterFhirId);
        setNoteFhirId(result.noteFhirId);
        // Persist FHIR IDs to the tab so they survive tab switches
        if (activePatient && activeTabId) {
          updateTabProperties(activePatient.id, activeTabId, {
            encounterFhirId: result.encounterFhirId,
            noteFhirId: result.noteFhirId,
          });
        }
        return result;
      } else {
        setError(result.error || 'Failed to create encounter');
        setStatus('error');
        return null;
      }
    }
  }

  const handleSave = async () => {
    const appEncounter = buildAppEncounter();
    if (!appEncounter) return;

    const result = await persistEncounter(appEncounter);
    if (result) {
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  const handleSign = async () => {
    if (isSigned) {
      // Unsign (Edit): clear signing state locally and in FHIR
      const appEncounter = buildAppEncounter({ isSigned: false, signedAt: undefined, signedBy: undefined });
      if (!appEncounter) return;

      const result = await persistEncounter(appEncounter);
      if (result) {
        setIsSigned(false);
        setSignedAt(undefined);
        setSignedBy(undefined);
        if (activePatient && activeTabId) {
          updateTabProperties(activePatient.id, activeTabId, { isSigned: false, signedAt: undefined, signedBy: undefined });
        }
        setStatus('success');
        setTimeout(() => setStatus('idle'), 2000);
      }
    } else {
      // Sign: save + sign in one action
      const now = new Date().toISOString();
      const signer = user?.name || 'Unknown';
      const appEncounter = buildAppEncounter({ isSigned: true, signedAt: now, signedBy: signer });
      if (!appEncounter) return;

      const result = await persistEncounter(appEncounter);
      if (result) {
        setIsSigned(true);
        setSignedAt(now);
        setSignedBy(signer);
        if (activePatient && activeTabId) {
          updateTabProperties(activePatient.id, activeTabId, { isSigned: true, signedAt: now, signedBy: signer });
        }
        // Auto-assign patient to current user for case library
        if (activePatient?.fhirId) {
          fetch('/api/user/patients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patientFhirId: activePatient.fhirId }),
          }).catch(() => {});
        }
        setStatus('success');
        setTimeout(() => setStatus('idle'), 2000);
      }
    }
  };

  const handleChartReview = () => {
    // If chart review panel is already open, prompt before re-running
    if (rightPanelOpen && rightPanelType === 'chartReview') {
      if (!window.confirm('Re-run chart review with current notes?')) return;
    }

    const htmlContent = tabContent[activeTabId!] || activeTab?.content || '';
    const plainText = stripHtml(htmlContent);

    setChartReviewContent({
      noteText: plainText,
      patientName: activePatient?.name || '',
      patientDob: activePatient?.dob || '',
      encounterDate,
      providerName: user?.name || '',
    });
    setRightPanelType('chartReview');
  };

  const formatSignedDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
    } catch {
      return iso;
    }
  };

  return (
    <div className="border-b border-gray-200 px-6 py-3 flex items-center gap-4 bg-gray-50 flex-shrink-0">
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500">Date</label>
        <input
          type="date"
          value={encounterDate}
          onChange={(e) => setEncounterDate(e.target.value)}
          disabled={isSigned}
          className={`px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${isSigned ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500">Type</label>
        <select
          value={encounterClass}
          onChange={(e) => setEncounterClass(e.target.value as AppEncounter['classCode'])}
          disabled={isSigned}
          className={`px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${isSigned ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'}`}
        >
          {ENCOUNTER_CLASS_OPTIONS.map(opt => (
            <option key={opt.code} value={opt.code}>{opt.display}</option>
          ))}
        </select>
      </div>

      <div className="flex-1" />

      {isSigned && signedAt && (
        <span className="text-xs text-gray-500">
          Signed{signedBy ? ` by ${signedBy}` : ''} on {formatSignedDate(signedAt)}
        </span>
      )}

      {status === 'saving' && (
        <span className="text-xs text-blue-600">Saving...</span>
      )}
      {status === 'success' && (
        <span className="text-xs text-green-600">
          {encounterFhirId ? 'Saved' : 'Created'}
        </span>
      )}
      {status === 'error' && error && (
        <span className="text-xs text-red-600">{error}</span>
      )}

      <button
        onClick={toggleRecording}
        disabled={isTranscribing || isSigned}
        className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
          isRecording
            ? 'bg-red-100 text-red-500 hover:bg-red-200'
            : isTranscribing
              ? 'text-amber-500 animate-pulse'
              : isModelLoading
                ? 'text-blue-400 animate-pulse'
                : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        title={
          isSigned ? 'Unlock note to dictate' :
          isRecording ? 'Stop recording' :
          isTranscribing ? 'Transcribing...' :
          isModelLoading ? `Loading model (${progress}%)` :
          'Voice dictation'
        }
      >
        {isRecording ? (
          <div className="w-3 h-3 bg-red-500 rounded-sm" />
        ) : (
          <Mic size={16} />
        )}
      </button>

      <button
        onClick={handleChartReview}
        disabled={!isSigned || (!tabContent[activeTabId!]?.trim() && !activeTab?.content?.trim())}
        className="px-4 py-1.5 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Chart Review
      </button>

      <button
        onClick={handleSave}
        disabled={status === 'saving' || isSigned}
        className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'saving'
          ? 'Saving...'
          : encounterFhirId
            ? 'Update'
            : 'Save'}
      </button>

      <button
        onClick={handleSign}
        disabled={status === 'saving'}
        className={`px-4 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          isSigned
            ? 'bg-amber-500 text-white hover:bg-amber-600'
            : 'bg-green-600 text-white hover:bg-green-700'
        }`}
      >
        {status === 'saving' ? 'Saving...' : isSigned ? 'Edit' : 'Sign'}
      </button>
    </div>
  );
}
