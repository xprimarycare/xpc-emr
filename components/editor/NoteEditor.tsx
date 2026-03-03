'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { usePatient } from '@/lib/context/PatientContext';
import { useEditor } from '@/lib/context/EditorContext';
import { VariableAutocomplete } from './VariableAutocomplete';

interface NoteEditorProps {
  placeholder?: string;
  onContentChange?: (plainText: string) => void;
  readOnly?: boolean;
}

export function NoteEditor({
  placeholder = 'Start typing your notes here...',
  onContentChange,
  readOnly = false,
}: NoteEditorProps) {
  const { activePatient, updatePatient } = usePatient();
  const { activeTabId, tabContent, updateTabContent } = useEditor();
  const editorRef = useRef<HTMLDivElement>(null);
  const [autocomplete, setAutocomplete] = useState<{
    show: boolean;
    query: string;
    position: { top: number; left: number };
  }>({ show: false, query: '', position: { top: 0, left: 0 } });

  const activeTab = activePatient?.tabs.find(t => t.id === activeTabId);

  // Load editor content when tab changes
  // Note: Content is app-controlled from PatientContext, same pattern as the existing
  // RichTextEditor, EncounterTab, and TaskTab components.
  useEffect(() => {
    if (editorRef.current && activeTab && activeTabId) {
      const content = tabContent[activeTabId] || activeTab.content;
      if (editorRef.current.innerHTML !== content) {
        editorRef.current.innerHTML = content;
      }
    }
  }, [activeTabId, activeTab, tabContent]);

  // Listen for template insertion events
  // Note: Template content is app-controlled from mockTemplates (lib/data/mock-variables.ts),
  // not user-supplied HTML. Same trust model as the existing content loading above.
  useEffect(() => {
    const handleInsertTemplate = (e: CustomEvent<string>) => {
      if (!editorRef.current || !activeTabId) return;
      // Append template HTML to editor (content is from app-controlled mockTemplates)
      editorRef.current.innerHTML += e.detail;
      const content = editorRef.current.innerHTML;
      updateTabContent(activeTabId, content);
      if (activePatient && activeTab) {
        const updatedTabs = activePatient.tabs.map(tab =>
          tab.id === activeTabId ? { ...tab, content } : tab
        );
        updatePatient(activePatient.id, { tabs: updatedTabs });
      }
    };
    window.addEventListener('insertTemplate', handleInsertTemplate as EventListener);
    return () => window.removeEventListener('insertTemplate', handleInsertTemplate as EventListener);
  }, [activeTabId, activePatient, activeTab, updateTabContent, updatePatient]);

  const handleInput = useCallback(() => {
    if (!editorRef.current || !activeTabId) return;

    const content = editorRef.current.innerHTML;
    updateTabContent(activeTabId, content);

    if (activePatient && activeTab) {
      const updatedTabs = activePatient.tabs.map(tab =>
        tab.id === activeTabId ? { ...tab, content } : tab
      );
      updatePatient(activePatient.id, { tabs: updatedTabs });
    }

    // Notify parent of plain text change if needed
    if (onContentChange) {
      const tmp = document.createElement('div');
      tmp.innerHTML = content;
      onContentChange(tmp.textContent || tmp.innerText || '');
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
  }, [activeTabId, activePatient, activeTab, updateTabContent, updatePatient, onContentChange]);

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

        // Note: Variable content is from app-controlled sources (mockVariables/user input)
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

  return (
    <div className="h-full relative overflow-y-auto">
      <div
        ref={editorRef}
        contentEditable={!readOnly}
        onInput={readOnly ? undefined : handleInput}
        className={`min-h-full px-8 py-6 focus:outline-none text-gray-900 ${readOnly ? 'bg-gray-50 cursor-default' : ''}`}
        style={{ fontSize: '15px', lineHeight: '1.6' }}
        suppressContentEditableWarning
        data-placeholder={placeholder}
      />
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
