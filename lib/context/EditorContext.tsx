'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { TabSection } from '../types/tab';

export type LeftPanelMode = 'sidebar' | 'patientList' | null;

interface EditorContextType {
  activeTabId: string | null;
  setActiveTabId: (id: string | null) => void;
  collapsedSections: Record<TabSection, boolean>;
  toggleSection: (section: TabSection) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  tabContent: Record<string, string>;
  updateTabContent: (tabId: string, content: string) => void;
  leftPanelMode: LeftPanelMode;
  toggleLeftPanel: (type: 'sidebar' | 'patientList') => void;
  leftSidebarCollapsed: boolean;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export function EditorProvider({ children }: { children: ReactNode }) {
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<TabSection, boolean>>({
    pages: false,
    encounters: false,
    tasks: false
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [tabContent, setTabContent] = useState<Record<string, string>>({});
  const [leftPanelMode, setLeftPanelMode] = useState<LeftPanelMode>('sidebar');

  const leftSidebarCollapsed = leftPanelMode !== 'sidebar';

  useEffect(() => {
    const handleSetActiveTab = (event: CustomEvent<string>) => {
      setActiveTabId(event.detail);
    };

    window.addEventListener('setActiveTab', handleSetActiveTab as EventListener);
    return () => {
      window.removeEventListener('setActiveTab', handleSetActiveTab as EventListener);
    };
  }, []);

  const toggleSection = (section: TabSection) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const updateTabContent = (tabId: string, content: string) => {
    setTabContent(prev => ({
      ...prev,
      [tabId]: content
    }));
  };

  const toggleLeftPanel = (type: 'sidebar' | 'patientList') => {
    setLeftPanelMode(prev => prev === type ? null : type);
  };

  return (
    <EditorContext.Provider
      value={{
        activeTabId,
        setActiveTabId,
        collapsedSections,
        toggleSection,
        searchQuery,
        setSearchQuery,
        tabContent,
        updateTabContent,
        leftPanelMode,
        toggleLeftPanel,
        leftSidebarCollapsed
      }}
    >
      {children}
    </EditorContext.Provider>
  );
}

export function useEditor() {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditor must be used within EditorProvider');
  }
  return context;
}
