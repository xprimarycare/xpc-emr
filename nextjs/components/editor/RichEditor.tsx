'use client';

import { useEffect, useRef, useState } from 'react';
import { useTabs, useSaveTab } from '@/hooks/useTabs';
import { useVariables } from '@/hooks/useVariables';
import { useDebounce } from '@/hooks/useDebounce';
import type { Tab } from '@/lib/types';

interface RichEditorProps {
  patientId: string | null;
  activeTabId: string | null;
}

export function RichEditor({ patientId, activeTabId }: RichEditorProps) {
  const { data: tabs = [] } = useTabs(patientId);
  const { data: variables = {} } = useVariables(patientId);
  const saveTab = useSaveTab();
  const [localContent, setLocalContent] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);
  const debouncedContent = useDebounce(localContent, 1000);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Update local content when active tab changes
  useEffect(() => {
    if (activeTab && contentRef.current) {
      contentRef.current.innerHTML = activeTab.content || '';
      setLocalContent(activeTab.content || '');
    }
  }, [activeTab?.id]); // Only trigger on tab ID change

  // Save debounced content
  useEffect(() => {
    if (patientId && activeTab && debouncedContent !== activeTab.content) {
      const updatedTab: Tab = {
        ...activeTab,
        content: debouncedContent,
      };
      saveTab.mutate({ patientId, tab: updatedTab });
    }
  }, [debouncedContent, patientId, activeTab, saveTab]);

  const handleInput = () => {
    if (contentRef.current) {
      setLocalContent(contentRef.current.innerHTML);
    }
  };

  // Handle @ key for variable autocomplete (simplified version)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === '@') {
      // TODO: Show variable autocomplete dropdown
      console.log('Show variable autocomplete');
    }
  };

  if (!patientId || !activeTab) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <p className="text-lg mb-2">No document selected</p>
          <p className="text-sm">Select a document from the sidebar to begin</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-white">
      <div className="max-w-4xl mx-auto">
        <div
          ref={contentRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          className="px-8 py-16 text-base text-gray-900 outline-none min-h-screen cursor-text"
          data-placeholder="Start typing your notes here..."
          style={{
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
          }}
        />
        <style jsx>{`
          [data-placeholder]:empty::before {
            content: attr(data-placeholder);
            color: #9ca3af;
            pointer-events: none;
          }
        `}</style>
      </div>
    </div>
  );
}
