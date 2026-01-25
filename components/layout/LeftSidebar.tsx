'use client';

import React, { useMemo } from 'react';
import { SidebarSection } from '../sidebar/SidebarSection';
import { TabItem } from '../sidebar/TabItem';
import { usePatient } from '@/lib/context/PatientContext';
import { useEditor } from '@/lib/context/EditorContext';
import { TabItemData } from '@/lib/types/tab';
import { TabSection } from '@/lib/types/tab';

export function LeftSidebar() {
  const { activePatient, addTabToPatient, renameTab, toggleTabStar, deleteTab, duplicateTab, updateTabProperties, reorderTabs } = usePatient();
  const { activeTabId, setActiveTabId, collapsedSections, toggleSection, searchQuery, leftSidebarCollapsed } = useEditor();
  const [dragState, setDragState] = React.useState<{
    isDragging: boolean;
    draggedTabId: string | null;
    dropTarget: string | null;
    dropPosition: 'before' | 'after' | 'child' | null;
  }>({
    isDragging: false,
    draggedTabId: null,
    dropTarget: null,
    dropPosition: null
  });

  const filteredTabs = useMemo(() => {
    if (!activePatient) return { pages: [], encounters: [], tasks: [] };

    const query = searchQuery.toLowerCase();
    const filtered = activePatient.tabs.filter(tab =>
      tab.name.toLowerCase().includes(query)
    );

    return {
      pages: filtered.filter(tab => tab.section === 'pages'),
      encounters: filtered.filter(tab => tab.section === 'encounters'),
      tasks: filtered.filter(tab => tab.section === 'tasks')
    };
  }, [activePatient, searchQuery]);

  const handleAddTab = (section: TabSection) => {
    if (!activePatient) return;

    const timestamp = Date.now();
    let newTabName = '';
    let isVisit = false;
    let isTask = false;
    let visitDate = '';

    switch (section) {
      case 'pages':
        newTabName = 'Untitled Page';
        break;
      case 'encounters':
        newTabName = 'New Encounter';
        isVisit = true;
        visitDate = new Date().toISOString().split('T')[0];
        break;
      case 'tasks':
        newTabName = 'New Task';
        isTask = true;
        break;
    }

    const newTab = {
      id: `tab-${activePatient.id}-${timestamp}`,
      name: newTabName,
      content: '',
      section,
      isVisit,
      isTask,
      visitDate
    };

    addTabToPatient(activePatient.id, newTab);
    setActiveTabId(newTab.id);
  };

  const handleRenameTab = (tabId: string, newName: string) => {
    if (!activePatient) return;
    renameTab(activePatient.id, tabId, newName);
  };

  const handleToggleStar = (tabId: string) => {
    if (!activePatient) return;
    toggleTabStar(activePatient.id, tabId);
  };

  const handleDeleteTab = (tabId: string) => {
    if (!activePatient) return;
    deleteTab(activePatient.id, tabId);
    // If deleting active tab, switch to first available tab
    if (tabId === activeTabId && activePatient.tabs.length > 1) {
      const remainingTabs = activePatient.tabs.filter(t => t.id !== tabId);
      if (remainingTabs.length > 0) {
        setActiveTabId(remainingTabs[0].id);
      }
    }
  };

  const handleDuplicateTab = (tabId: string) => {
    if (!activePatient) return;
    duplicateTab(activePatient.id, tabId);
  };

  const handleMarkAsEncounter = (tabId: string) => {
    if (!activePatient) return;
    const tab = activePatient.tabs.find(t => t.id === tabId);
    const isCurrentlyEncounter = tab?.isVisit;
    updateTabProperties(activePatient.id, tabId, {
      isVisit: !isCurrentlyEncounter,
      isTask: false,
      section: !isCurrentlyEncounter ? 'encounters' : 'pages',
      visitDate: !isCurrentlyEncounter ? new Date().toISOString().split('T')[0] : undefined
    });
  };

  const handleMarkAsTask = (tabId: string) => {
    if (!activePatient) return;
    const tab = activePatient.tabs.find(t => t.id === tabId);
    const isCurrentlyTask = tab?.isTask;
    updateTabProperties(activePatient.id, tabId, {
      isTask: !isCurrentlyTask,
      isVisit: false,
      section: !isCurrentlyTask ? 'tasks' : 'pages',
      visitDate: undefined
    });
  };

  const handleDragStart = (tabId: string) => {
    setDragState({
      isDragging: true,
      draggedTabId: tabId,
      dropTarget: null,
      dropPosition: null
    });
  };

  const handleDragOver = (tabId: string, position: 'before' | 'after' | 'child') => {
    setDragState(prev => ({
      ...prev,
      dropTarget: tabId,
      dropPosition: position
    }));
  };

  const handleDragLeave = () => {
    setDragState(prev => ({
      ...prev,
      dropTarget: null,
      dropPosition: null
    }));
  };

  const handleDrop = (draggedTabId: string, targetTabId: string, position: 'before' | 'after' | 'child') => {
    if (!activePatient || draggedTabId === targetTabId) {
      setDragState({
        isDragging: false,
        draggedTabId: null,
        dropTarget: null,
        dropPosition: null
      });
      return;
    }

    reorderTabs(activePatient.id, draggedTabId, targetTabId, position);

    setDragState({
      isDragging: false,
      draggedTabId: null,
      dropTarget: null,
      dropPosition: null
    });
  };

  if (leftSidebarCollapsed) {
    return null;
  }

  if (!activePatient) {
    return (
      <div className="w-60 border-r bg-white p-4 transition-all duration-200">
        <p className="text-sm text-gray-500">No patient selected</p>
      </div>
    );
  }

  return (
    <div className="w-60 border-r bg-white overflow-y-auto p-3 transition-all duration-200">
      <SidebarSection
        title="Pages"
        section="pages"
        collapsed={collapsedSections.pages}
        onToggle={() => toggleSection('pages')}
        onAddNew={() => handleAddTab('pages')}
      >
        {filteredTabs.pages.map(tab => (
          <TabItem
            key={tab.id}
            tab={tab as TabItemData}
            isActive={tab.id === activeTabId}
            onClick={() => setActiveTabId(tab.id)}
            onRename={(newName) => handleRenameTab(tab.id, newName)}
            onToggleStar={() => handleToggleStar(tab.id)}
            onMarkAsEncounter={() => handleMarkAsEncounter(tab.id)}
            onMarkAsTask={() => handleMarkAsTask(tab.id)}
            onDelete={() => handleDeleteTab(tab.id)}
            onDuplicate={() => handleDuplicateTab(tab.id)}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            dragState={dragState}
          />
        ))}
      </SidebarSection>

      <SidebarSection
        title="Encounters"
        section="encounters"
        collapsed={collapsedSections.encounters}
        onToggle={() => toggleSection('encounters')}
        onAddNew={() => handleAddTab('encounters')}
      >
        {filteredTabs.encounters.map(tab => (
          <TabItem
            key={tab.id}
            tab={tab as TabItemData}
            isActive={tab.id === activeTabId}
            onClick={() => setActiveTabId(tab.id)}
            onRename={(newName) => handleRenameTab(tab.id, newName)}
            onToggleStar={() => handleToggleStar(tab.id)}
            onMarkAsEncounter={() => handleMarkAsEncounter(tab.id)}
            onMarkAsTask={() => handleMarkAsTask(tab.id)}
            onDelete={() => handleDeleteTab(tab.id)}
            onDuplicate={() => handleDuplicateTab(tab.id)}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            dragState={dragState}
          />
        ))}
      </SidebarSection>

      <SidebarSection
        title="Tasks"
        section="tasks"
        collapsed={collapsedSections.tasks}
        onToggle={() => toggleSection('tasks')}
        onAddNew={() => handleAddTab('tasks')}
      >
        {filteredTabs.tasks.map(tab => (
          <TabItem
            key={tab.id}
            tab={tab as TabItemData}
            isActive={tab.id === activeTabId}
            onClick={() => setActiveTabId(tab.id)}
            onRename={(newName) => handleRenameTab(tab.id, newName)}
            onToggleStar={() => handleToggleStar(tab.id)}
            onMarkAsEncounter={() => handleMarkAsEncounter(tab.id)}
            onMarkAsTask={() => handleMarkAsTask(tab.id)}
            onDelete={() => handleDeleteTab(tab.id)}
            onDuplicate={() => handleDuplicateTab(tab.id)}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            dragState={dragState}
          />
        ))}
      </SidebarSection>
    </div>
  );
}
