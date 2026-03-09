'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { usePatient } from '@/lib/context/PatientContext';
import { useEditor } from '@/lib/context/EditorContext';
import { VariableAutocomplete } from '@/components/editor/VariableAutocomplete';
import { AppTask, TASK_STATUS_OPTIONS } from '@/lib/types/task';
import {
  createFhirTask,
  upsertFhirTask,
} from '@/lib/services/fhir-task-service';

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

export function TaskTab() {
  const { activePatient, updatePatient, renameTab } = usePatient();
  const { activeTabId, tabContent, updateTabContent } = useEditor();
  const editorRef = useRef<HTMLDivElement>(null);
  const isFhirPatient = !!activePatient?.fhirId;

  const activeTab = activePatient?.tabs?.find(t => t.id === activeTabId);

  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<AppTask['status']>('requested');
  const [dueDate, setDueDate] = useState('');
  // Track the FHIR ID once created, so subsequent saves are updates not creates
  const [taskFhirId, setTaskFhirId] = useState<string | undefined>();
  const [autocomplete, setAutocomplete] = useState<{
    show: boolean;
    query: string;
    position: { top: number; left: number };
  }>({ show: false, query: '', position: { top: 0, left: 0 } });

  // Load editor content when tab changes
  // Note: innerHTML assignment here uses app-controlled content from PatientContext
  // (not external/user-submitted HTML), matching the existing RichTextEditor pattern
  useEffect(() => {
    if (editorRef.current && activeTab && activeTabId) {
      const content = tabContent[activeTabId] || activeTab.content;
      if (editorRef.current.innerHTML !== content) {
        // Content is app-controlled from PatientContext, same pattern as RichTextEditor/EncounterTab
        editorRef.current.innerHTML = content;
      }
    }
  }, [activeTabId, activeTab, tabContent]);

  // Reset FHIR state when switching tabs
  useEffect(() => {
    setTaskFhirId(undefined);
    setTaskStatus('requested');
    setDueDate('');
    setStatus('idle');
    setError(null);
  }, [activeTabId]);

  const handleInput = useCallback(() => {
    if (!editorRef.current || !activeTabId) return;

    const content = editorRef.current.innerHTML;
    updateTabContent(activeTabId, content);

    if (activePatient && activeTab) {
      const updatedTabs = activePatient.tabs.map(tab =>
        tab.id === activeTabId ? { ...tab, content } : tab
      );
      updatePatient(activePatient.id, { tabs: updatedTabs });

      // Auto-rename task tab from the first line of content
      const tmp = document.createElement('div');
      tmp.innerHTML = content;
      const plainText = (tmp.textContent || tmp.innerText || '').trim();
      const firstLine = plainText.split('\n')[0].trim();
      const autoName = firstLine
        ? firstLine.length > 40 ? firstLine.slice(0, 40) + '…' : firstLine
        : 'New Task';
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

  /** Strip HTML tags to get plain text for the FHIR Task description */
  function stripHtml(html: string): string {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  const handleSave = async () => {
    if (!activePatient?.fhirId || !activeTabId) return;

    const htmlContent = tabContent[activeTabId] || activeTab?.content || '';
    const plainText = stripHtml(htmlContent);

    if (!plainText.trim()) {
      setError('Please write a task description before saving.');
      setStatus('error');
      return;
    }

    const appTask: AppTask = {
      id: activeTabId,
      fhirId: taskFhirId,
      status: taskStatus,
      intent: 'order',
      priority: 'routine',
      description: plainText,
      dueDate: dueDate || undefined,
      authoredOn: new Date().toISOString(),
      patientFhirId: activePatient.fhirId,
    };

    setStatus('saving');
    setError(null);

    if (taskFhirId) {
      // Update existing task
      const result = await upsertFhirTask(appTask);
      if (result.success) {
        setStatus('success');
        setTimeout(() => setStatus('idle'), 2000);
      } else {
        setError(result.error || 'Failed to update task');
        setStatus('error');
      }
    } else {
      // Create new task
      const result = await createFhirTask(appTask);
      if (result.success) {
        setTaskFhirId(result.fhirId);
        setStatus('success');
        setTimeout(() => setStatus('idle'), 2000);
      } else {
        setError(result.error || 'Failed to create task');
        setStatus('error');
      }
    }
  };

  if (!activeTab) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <p>Select a task to view</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Task metadata bar + save action */}
      {isFhirPatient && (
        <div className="border-b border-gray-200 px-6 py-3 flex items-center gap-4 bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Status</label>
            <select
              value={taskStatus}
              onChange={(e) => setTaskStatus(e.target.value as AppTask['status'])}
              className="px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {TASK_STATUS_OPTIONS.map(opt => (
                <option key={opt.code} value={opt.code}>{opt.display}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex-1" />

          {/* Status indicators */}
          {status === 'saving' && (
            <span className="text-xs text-blue-600">Saving...</span>
          )}
          {status === 'success' && (
            <span className="text-xs text-green-600">
              {taskFhirId ? 'Saved' : 'Created'}
            </span>
          )}
          {status === 'error' && error && (
            <span className="text-xs text-red-600">{error}</span>
          )}

          <button
            onClick={handleSave}
            disabled={status === 'saving'}
            className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'saving'
              ? 'Saving...'
              : taskFhirId
                ? 'Update'
                : 'Save'}
          </button>
        </div>
      )}

      {/* Free-text editor area */}
      <div className="flex-1 overflow-y-auto">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          className="min-h-full px-32 py-12 focus:outline-none text-gray-900"
          style={{ fontSize: '15px', lineHeight: '1.6' }}
          suppressContentEditableWarning
          data-placeholder="Describe the task here..."
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
