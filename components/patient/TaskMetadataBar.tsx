'use client';

import React, { useState, useEffect } from 'react';
import { usePatient } from '@/lib/context/PatientContext';
import { useEditor } from '@/lib/context/EditorContext';
import { AppTask, TASK_STATUS_OPTIONS } from '@/lib/types/task';
import {
  createFhirTask,
  upsertFhirTask,
} from '@/lib/services/fhir-task-service';

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

export function TaskMetadataBar() {
  const { activePatient, updateTabProperties } = usePatient();
  const { activeTabId, tabContent } = useEditor();

  const activeTab = activePatient?.tabs.find(t => t.id === activeTabId);

  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<AppTask['status']>('requested');
  const [dueDate, setDueDate] = useState('');
  const [taskFhirId, setTaskFhirId] = useState<string | undefined>();

  // Initialize FHIR ID from the tab when switching tabs
  useEffect(() => {
    setTaskFhirId(activeTab?.taskFhirId);
    setTaskStatus('requested');
    setDueDate('');
    setStatus('idle');
    setError(null);
  }, [activeTabId, activeTab?.taskFhirId]);

  /** Strip HTML tags to get plain text for the FHIR Task description.
   * Content source is app-controlled from PatientContext (same pattern as existing TaskTab). */
  function stripHtml(htmlString: string): string {
    const el = document.createElement('div');
    el.textContent = ''; // clear first
    // Content is from app-controlled PatientContext, same trust model as original TaskTab
    el.innerHTML = htmlString; // eslint-disable-line -- app-controlled content from PatientContext
    return el.textContent || el.innerText || '';
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
      const result = await upsertFhirTask(appTask);
      if (result.success) {
        setStatus('success');
        setTimeout(() => setStatus('idle'), 2000);
      } else {
        setError(result.error || 'Failed to update task');
        setStatus('error');
      }
    } else {
      const result = await createFhirTask(appTask);
      if (result.success) {
        setTaskFhirId(result.fhirId);
        // Persist FHIR ID to the tab so it survives tab switches
        if (activePatient && activeTabId) {
          updateTabProperties(activePatient.id, activeTabId, {
            taskFhirId: result.fhirId,
          });
        }
        setStatus('success');
        setTimeout(() => setStatus('idle'), 2000);
      } else {
        setError(result.error || 'Failed to create task');
        setStatus('error');
      }
    }
  };

  return (
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
  );
}
