'use client';

import React, { useState, useCallback } from 'react';
import { Mic, RefreshCw } from 'lucide-react';
import { usePatient } from '@/lib/context/PatientContext';
import { useEditor } from '@/lib/context/EditorContext';
import { useWhisper } from '@/lib/hooks/useWhisper';

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

interface PageMetadataBarProps {
  showNote?: boolean;
  onToggleNote?: () => void;
  labView?: 'pending' | 'results';
  onLabViewChange?: (view: 'pending' | 'results') => void;
  labCounts?: { pending: number; results: number };
  imagingView?: 'pending' | 'results';
  onImagingViewChange?: (view: 'pending' | 'results') => void;
  imagingCounts?: { pending: number; results: number };
  referralView?: 'pending' | 'completed';
  onReferralViewChange?: (view: 'pending' | 'completed') => void;
  referralCounts?: { pending: number; completed: number };
  onRefresh?: () => void;
}

export function PageMetadataBar({ showNote, onToggleNote, labView, onLabViewChange, labCounts, imagingView, onImagingViewChange, imagingCounts, referralView, onReferralViewChange, referralCounts, onRefresh }: PageMetadataBarProps) {
  const { activePatient } = usePatient();
  const { activeTabId, tabContent } = useEditor();
  const activeTab = activePatient?.tabs.find(t => t.id === activeTabId);
  const isFhirPatient = !!activePatient?.fhirId;

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

  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSaveToMedplum = async () => {
    // TODO: Implement FHIR save — determine resource type (DocumentReference, etc.)
    // For now, just flash a placeholder status
    setStatus('saving');
    setError(null);
    setTimeout(() => {
      setStatus('error');
      setError('FHIR save not yet implemented for page notes');
      setTimeout(() => setStatus('idle'), 3000);
    }, 500);
  };

  if (!isFhirPatient) return null;

  return (
    <div className="border-b border-gray-200 px-6 py-3 flex items-center gap-4 bg-gray-50 flex-shrink-0">
      <span className="text-sm font-medium text-gray-600">
        {activeTab?.name || 'Page'}
      </span>

      {onRefresh && (
        <button
          onClick={onRefresh}
          className="p-1 rounded hover:bg-gray-200 transition-colors text-gray-400 hover:text-gray-600"
          title="Refresh data"
        >
          <RefreshCw size={14} />
        </button>
      )}

      {labView && onLabViewChange && (
        <div className="bg-gray-200 rounded-lg p-0.5 flex">
          <button
            onClick={() => onLabViewChange('pending')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              labView === 'pending'
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Pending{labCounts ? ` (${labCounts.pending})` : ''}
          </button>
          <button
            onClick={() => onLabViewChange('results')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              labView === 'results'
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Lab Results{labCounts ? ` (${labCounts.results})` : ''}
          </button>
        </div>
      )}

      {imagingView && onImagingViewChange && (
        <div className="bg-gray-200 rounded-lg p-0.5 flex">
          <button
            onClick={() => onImagingViewChange('pending')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              imagingView === 'pending'
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Pending{imagingCounts ? ` (${imagingCounts.pending})` : ''}
          </button>
          <button
            onClick={() => onImagingViewChange('results')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              imagingView === 'results'
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Imaging Results{imagingCounts ? ` (${imagingCounts.results})` : ''}
          </button>
        </div>
      )}

      {referralView && onReferralViewChange && (
        <div className="bg-gray-200 rounded-lg p-0.5 flex">
          <button
            onClick={() => onReferralViewChange('pending')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              referralView === 'pending'
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Pending{referralCounts ? ` (${referralCounts.pending})` : ''}
          </button>
          <button
            onClick={() => onReferralViewChange('completed')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              referralView === 'completed'
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Completed{referralCounts ? ` (${referralCounts.completed})` : ''}
          </button>
        </div>
      )}

      <div className="flex-1" />

      {status === 'saving' && (
        <span className="text-xs text-blue-600">Saving to Medplum...</span>
      )}
      {status === 'success' && (
        <span className="text-xs text-green-600">Saved to Medplum</span>
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

      {onToggleNote && (
        <button
          onClick={onToggleNote}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            showNote
              ? 'bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200'
              : 'bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200'
          }`}
        >
          {showNote ? 'Hide Notes' : 'Show Notes'}
        </button>
      )}

      <button
        onClick={handleSaveToMedplum}
        disabled={status === 'saving'}
        className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'saving' ? 'Saving...' : 'Save to Medplum'}
      </button>
    </div>
  );
}
