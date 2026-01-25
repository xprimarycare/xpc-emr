'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { TabSection } from '../types/tab';

interface EditorContextType {
  activeTabId: string | null;
  setActiveTabId: (id: string) => void;
  collapsedSections: Record<TabSection, boolean>;
  toggleSection: (section: TabSection) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  tabContent: Record<string, string>;
  updateTabContent: (tabId: string, content: string) => void;
  leftSidebarCollapsed: boolean;
  toggleLeftSidebar: () => void;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export function EditorProvider({ children }: { children: ReactNode }) {
  const [activeTabId, setActiveTabId] = useState<string | null>('tab-1');
  const [collapsedSections, setCollapsedSections] = useState<Record<TabSection, boolean>>({
    pages: false,
    encounters: false,
    tasks: false
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [tabContent, setTabContent] = useState<Record<string, string>>({});
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);

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

  const toggleLeftSidebar = () => {
    setLeftSidebarCollapsed(prev => !prev);
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
        leftSidebarCollapsed,
        toggleLeftSidebar
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
