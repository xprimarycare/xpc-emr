'use client';

import React, { useRef, useEffect, useState } from 'react';
import { usePatient } from '@/lib/context/PatientContext';
import { useEditor } from '@/lib/context/EditorContext';
import { VariableAutocomplete } from './VariableAutocomplete';

export function RichTextEditor() {
  const { activePatient, updatePatient } = usePatient();
  const { activeTabId, tabContent, updateTabContent } = useEditor();
  const editorRef = useRef<HTMLDivElement>(null);
  const [autocomplete, setAutocomplete] = useState<{
    show: boolean;
    query: string;
    position: { top: number; left: number };
  }>({ show: false, query: '', position: { top: 0, left: 0 } });

  const activeTab = activePatient?.tabs?.find(t => t.id === activeTabId);

  useEffect(() => {
    if (editorRef.current && activeTab && activeTabId) {
      const content = tabContent[activeTabId] || activeTab.content;
      if (editorRef.current.innerHTML !== content) {
        editorRef.current.innerHTML = content;
      }
    }
  }, [activeTabId, activeTab, tabContent]);

  const handleInput = () => {
    if (!editorRef.current || !activeTabId) return;

    const content = editorRef.current.innerHTML;
    updateTabContent(activeTabId, content);

    if (activePatient && activeTab) {
      const updatedTabs = activePatient.tabs.map(tab =>
        tab.id === activeTabId ? { ...tab, content } : tab
      );
      updatePatient(activePatient.id, { tabs: updatedTabs });
    }

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
  };

  const handleVariableSelect = (variableName: string, content: string) => {
    if (!editorRef.current) return;

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const textNode = range.startContainer;
      const text = textNode.textContent || '';
      const cursorPos = range.startOffset;

      const beforeAt = text.substring(0, cursorPos).lastIndexOf('@');
      if (beforeAt !== -1 && textNode.nodeType === Node.TEXT_NODE) {
        // Create a range that selects only the @mention text (from @ to cursor)
        const deleteRange = document.createRange();
        deleteRange.setStart(textNode, beforeAt);
        deleteRange.setEnd(textNode, cursorPos);

        // Delete only the @mention portion, preserving sibling content
        deleteRange.deleteContents();

        // Insert variable content as text node (strip HTML for safety)
        // Note: Variable content is from app-controlled sources (mockVariables/user input)
        const plainText = content.replace(/<[^>]+>/g, '').trim();
        const newTextNode = document.createTextNode(plainText);
        deleteRange.insertNode(newTextNode);

        // Move cursor after inserted content
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
  };

  if (!activeTab) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <p>Select a page to view content</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="min-h-full px-32 py-12 focus:outline-none text-gray-900"
        style={{ fontSize: '15px', lineHeight: '1.6' }}
        suppressContentEditableWarning
        data-placeholder="Start typing your notes here..."
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
