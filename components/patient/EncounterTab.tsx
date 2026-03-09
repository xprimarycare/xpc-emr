'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { usePatient } from '@/lib/context/PatientContext';
import { useEditor } from '@/lib/context/EditorContext';
import { VariableAutocomplete } from '@/components/editor/VariableAutocomplete';
import { AppEncounter, ENCOUNTER_CLASS_OPTIONS } from '@/lib/types/encounter';
import {
  createFhirEncounter,
  updateFhirEncounter,
} from '@/lib/services/fhir-encounter-service';

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

export function EncounterTab() {
  const { user } = useAuth();
  const { activePatient, updatePatient, renameTab, updateTabProperties } = usePatient();
  const { activeTabId, tabContent, updateTabContent } = useEditor();
  const editorRef = useRef<HTMLDivElement>(null);
  const isFhirPatient = !!activePatient?.fhirId;

  const activeTab = activePatient?.tabs.find(t => t.id === activeTabId);

  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [encounterClass, setEncounterClass] = useState<AppEncounter['classCode']>('AMB');
  const [encounterDate, setEncounterDate] = useState(
    activeTab?.visitDate || new Date().toISOString().split('T')[0]
  );
  // Track the FHIR IDs once created, so subsequent saves are updates not creates
  const [encounterFhirId, setEncounterFhirId] = useState<string | undefined>();
  const [noteFhirId, setNoteFhirId] = useState<string | undefined>();
  const [isSigned, setIsSigned] = useState(false);
  const [signedAt, setSignedAt] = useState<string | undefined>();
  const [signedBy, setSignedBy] = useState<string | undefined>();
  const [signedById, setSignedById] = useState<string | undefined>();
  const [autocomplete, setAutocomplete] = useState<{
    show: boolean;
    query: string;
    position: { top: number; left: number };
  }>({ show: false, query: '', position: { top: 0, left: 0 } });

  // Load editor content when tab changes
  // Note: content assignment here uses app-controlled content from PatientContext
  // (not external/user-submitted HTML), matching the existing RichTextEditor pattern
  useEffect(() => {
    if (editorRef.current && activeTab && activeTabId) {
      const content = tabContent[activeTabId] || activeTab.content;
      if (editorRef.current.innerHTML !== content) {
        // Content is app-controlled from PatientContext (same pattern as existing RichTextEditor)
        editorRef.current.innerHTML = content;
      }
    }
  }, [activeTabId, activeTab, tabContent]);

  // Reset state when switching tabs
  useEffect(() => {
    setEncounterFhirId(activeTab?.encounterFhirId);
    setNoteFhirId(activeTab?.noteFhirId);
    setIsSigned(!!activeTab?.isSigned);
    setSignedAt(activeTab?.signedAt);
    setSignedBy(activeTab?.signedBy);
    setSignedById(activeTab?.signedById);
    setStatus('idle');
    setError(null);
    if (activeTab?.visitDate) {
      setEncounterDate(activeTab.visitDate);
    }
  }, [activeTabId, activeTab?.visitDate, activeTab?.encounterFhirId, activeTab?.noteFhirId, activeTab?.isSigned, activeTab?.signedAt, activeTab?.signedBy, activeTab?.signedById]);

  const handleInput = useCallback(() => {
    if (!editorRef.current || !activeTabId) return;

    const content = editorRef.current.innerHTML;
    updateTabContent(activeTabId, content);

    if (activePatient && activeTab) {
      const updatedTabs = activePatient.tabs.map(tab =>
        tab.id === activeTabId ? { ...tab, content } : tab
      );
      updatePatient(activePatient.id, { tabs: updatedTabs });

      // Auto-rename encounter tab from the first line of content
      const plainText = (editorRef.current.textContent || '').trim();
      const firstLine = plainText.split('\n')[0].trim();
      const autoName = firstLine
        ? firstLine.length > 40 ? firstLine.slice(0, 40) + '\u2026' : firstLine
        : 'New Encounter';
      if (activeTab.name !== autoName) {
        renameTab(activePatient.id, activeTabId, autoName);
      }
    }

    // Detect @variable mentions for autocomplete
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const textBeforeCursor = range.startContainer.textContent?.substring(0, range.startOffset) || '';
      const atMatch = textBeforeCursor.match(/@(\w*)$/);

      if (atMatch) {
        const rect = range.getBoundingClientRect();
        setAutocomplete({
          show: true,
          query: atMatch[1],
          position: {
            top: rect.bottom + window.scrollY,
            left: rect.left + window.scrollX
          }
        });
      } else {
        setAutocomplete({ show: false, query: '', position: { top: 0, left: 0 } });
      }
    }
  }, [activeTabId, activePatient, activeTab, updateTabContent, updatePatient]);

  const handleVariableSelect = useCallback((variableName: string, content: string) => {
    if (!editorRef.current) return;

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const textNode = range.startContainer;
      const text = textNode.textContent || '';
      const cursorPos = range.startOffset;

      const beforeAt = text.substring(0, cursorPos).lastIndexOf('@');
      if (beforeAt !== -1 && textNode.nodeType === Node.TEXT_NODE) {
        const deleteRange = document.createRange();
        deleteRange.setStart(textNode, beforeAt);
        deleteRange.setEnd(textNode, cursorPos);
        deleteRange.deleteContents();

        const plainText = content.replace(/<[^>]+>/g, '').trim();
        const newTextNode = document.createTextNode(plainText);
        deleteRange.insertNode(newTextNode);

        const newRange = document.createRange();
        newRange.setStartAfter(newTextNode);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    }

    setAutocomplete({ show: false, query: '', position: { top: 0, left: 0 } });
    editorRef.current.focus();
    handleInput();
  }, [handleInput]);

  /** Strip HTML tags to get plain text for the ClinicalImpression */
  function stripHtml(html: string): string {
    const tmp = document.createElement('div');
    // Content is app-controlled from PatientContext (same pattern as existing EncounterTab)
    tmp.innerHTML = html;
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

  /** Persist (create or update) an AppEncounter to EMR */
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
      // Unsign (Edit)
      const appEncounter = buildAppEncounter({ isSigned: false, signedAt: undefined, signedBy: undefined, signedById: undefined });
      if (!appEncounter) return;

      const result = await persistEncounter(appEncounter);
      if (result) {
        setIsSigned(false);
        setSignedAt(undefined);
        setSignedBy(undefined);
        setSignedById(undefined);
        if (activePatient && activeTabId) {
          updateTabProperties(activePatient.id, activeTabId, { isSigned: false, signedAt: undefined, signedBy: undefined, signedById: undefined });
        }
        setStatus('success');
        setTimeout(() => setStatus('idle'), 2000);
      }
    } else {
      // Sign: save + sign in one action
      const now = new Date().toISOString();
      const signer = user?.name || 'Unknown';
      const appEncounter = buildAppEncounter({ isSigned: true, signedAt: now, signedBy: signer, signedById: user?.id });
      if (!appEncounter) return;

      const result = await persistEncounter(appEncounter);
      if (result) {
        setIsSigned(true);
        setSignedAt(now);
        setSignedBy(signer);
        setSignedById(user?.id);
        if (activePatient && activeTabId) {
          updateTabProperties(activePatient.id, activeTabId, { isSigned: true, signedAt: now, signedBy: signer, signedById: user?.id });
        }
        setStatus('success');
        setTimeout(() => setStatus('idle'), 2000);
      }
    }
  };

  const formatSignedDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
    } catch {
      return iso;
    }
  };

  if (!activeTab) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <p>Select an encounter to view</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Encounter metadata bar + save action */}
      {isFhirPatient && (
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

          {/* Status indicators */}
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
      )}

      {/* Free-text editor area */}
      <div className="flex-1 overflow-y-auto">
        <div
          ref={editorRef}
          contentEditable={!isSigned}
          onInput={isSigned ? undefined : handleInput}
          className={`min-h-full px-32 py-12 focus:outline-none text-gray-900 ${isSigned ? 'bg-gray-50 cursor-default' : ''}`}
          style={{ fontSize: '15px', lineHeight: '1.6' }}
          suppressContentEditableWarning
          data-placeholder="Start typing your encounter notes here..."
        />
      </div>
      {autocomplete.show && (
        <VariableAutocomplete
          query={autocomplete.query}
          position={autocomplete.position}
          onSelect={handleVariableSelect}
          onClose={() => setAutocomplete({ show: false, query: '', position: { top: 0, left: 0 } })}
        />
      )}
    </div>
  );
}
