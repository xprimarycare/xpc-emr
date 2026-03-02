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

  // Initialize FHIR IDs from the tab when switching tabs
  useEffect(() => {
    setEncounterFhirId(activeTab?.encounterFhirId);
    setNoteFhirId(activeTab?.noteFhirId);
    setStatus('idle');
    setError(null);
    if (activeTab?.visitDate) {
      setEncounterDate(activeTab.visitDate);
    }
  }, [activeTabId, activeTab?.visitDate, activeTab?.encounterFhirId, activeTab?.noteFhirId]);

  /** Strip HTML tags to get plain text for the ClinicalImpression.
   * Note: content is app-controlled from PatientContext, not external user HTML. */
  function stripHtml(htmlString: string): string {
    const tmp = document.createElement('div');
    // Content is app-controlled from PatientContext (same pattern as existing EncounterTab)
    tmp.innerHTML = htmlString;
    return tmp.textContent || tmp.innerText || '';
  }

  const handleSaveToMedplum = async () => {
    if (!activePatient?.fhirId || !activeTabId) return;

    const htmlContent = tabContent[activeTabId] || activeTab?.content || '';
    const plainText = stripHtml(htmlContent);

    if (!plainText.trim()) {
      setError('Please write some encounter notes before saving.');
      setStatus('error');
      return;
    }

    const classOption = ENCOUNTER_CLASS_OPTIONS.find(c => c.code === encounterClass);

    const appEncounter: AppEncounter = {
      id: activeTabId,
      encounterFhirId,
      noteFhirId,
      status: 'finished',
      classCode: encounterClass,
      classDisplay: classOption?.display || encounterClass,
      date: new Date(encounterDate + 'T00:00:00').toISOString(),
      noteText: plainText,
      patientFhirId: activePatient.fhirId,
    };

    setStatus('saving');
    setError(null);

    if (encounterFhirId) {
      const result = await updateFhirEncounter(appEncounter);
      if (result.success) {
        setStatus('success');
        setTimeout(() => setStatus('idle'), 2000);
      } else {
        setError(result.error || 'Failed to update encounter');
        setStatus('error');
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
        setStatus('success');
        setTimeout(() => setStatus('idle'), 2000);
      } else {
        setError(result.error || 'Failed to create encounter');
        setStatus('error');
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

  return (
    <div className="border-b border-gray-200 px-6 py-3 flex items-center gap-4 bg-gray-50 flex-shrink-0">
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500">Date</label>
        <input
          type="date"
          value={encounterDate}
          onChange={(e) => setEncounterDate(e.target.value)}
          className="px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500">Type</label>
        <select
          value={encounterClass}
          onChange={(e) => setEncounterClass(e.target.value as AppEncounter['classCode'])}
          className="px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {ENCOUNTER_CLASS_OPTIONS.map(opt => (
            <option key={opt.code} value={opt.code}>{opt.display}</option>
          ))}
        </select>
      </div>

      <div className="flex-1" />

      {status === 'saving' && (
        <span className="text-xs text-blue-600">Saving to Medplum...</span>
      )}
      {status === 'success' && (
        <span className="text-xs text-green-600">
          {encounterFhirId ? 'Saved to Medplum' : 'Created in Medplum'}
        </span>
      )}
      {status === 'error' && error && (
        <span className="text-xs text-red-600">{error}</span>
      )}

      <button
        onClick={toggleRecording}
        disabled={isTranscribing}
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
        disabled={!tabContent[activeTabId!]?.trim() && !activeTab?.content?.trim()}
        className="px-4 py-1.5 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Chart Review
      </button>

      <button
        onClick={handleSaveToMedplum}
        disabled={status === 'saving'}
        className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'saving'
          ? 'Saving...'
          : encounterFhirId
            ? 'Update in Medplum'
            : 'Save to Medplum'}
      </button>
    </div>
  );
}
