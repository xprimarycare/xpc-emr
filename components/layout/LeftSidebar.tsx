'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { SidebarSection } from '../sidebar/SidebarSection';
import { TabItem } from '../sidebar/TabItem';
import { usePatient } from '@/lib/context/PatientContext';
import { useEditor } from '@/lib/context/EditorContext';
import { TabItemData } from '@/lib/types/tab';
import { TabSection } from '@/lib/types/tab';
import { Tab } from '@/lib/types/patient';
import { searchFhirEncounters } from '@/lib/services/fhir-encounter-service';
import { searchFhirTasks } from '@/lib/services/fhir-task-service';

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

  // Track which FHIR patients have already had their encounters/tasks loaded
  const loadedEncountersRef = useRef<Set<string>>(new Set());
  const loadedTasksRef = useRef<Set<string>>(new Set());

  // Fetch encounters from EMR when a FHIR patient is activated
  useEffect(() => {
    const patientId = activePatient?.id;
    const fhirId = activePatient?.fhirId;
    if (!fhirId || !patientId) return;
    if (loadedEncountersRef.current.has(fhirId)) return;

    // Mark as loaded immediately to avoid duplicate fetches
    loadedEncountersRef.current.add(fhirId);

    searchFhirEncounters(fhirId).then((result) => {
      if (result.error) {
        // Allow retry on failure
        loadedEncountersRef.current.delete(fhirId);
        return;
      }
      if (result.encounters.length === 0) return;

      // Re-read current tabs to avoid stale closure issues
      const currentPatient = activePatient;
      const existingFhirIds = new Set(
        (currentPatient?.tabs || [])
          .filter((t) => t.encounterFhirId)
          .map((t) => t.encounterFhirId)
      );

      const newTabs: Tab[] = result.encounters
        .filter((enc) => enc.encounterFhirId && !existingFhirIds.has(enc.encounterFhirId))
        .map((enc) => ({
          id: `enc-${enc.encounterFhirId}`,
          name: `${enc.classDisplay || enc.classCode} Visit`,
          content: enc.noteText || '',
          section: 'encounters' as const,
          isVisit: true,
          visitDate: enc.date ? enc.date.split('T')[0] : undefined,
          encounterFhirId: enc.encounterFhirId,
          noteFhirId: enc.noteFhirId,
          isSigned: enc.isSigned,
          signedAt: enc.signedAt,
          signedBy: enc.signedBy,
        }));

      if (newTabs.length > 0) {
        const hadNoEncounterTabs = existingFhirIds.size === 0;
        for (const tab of newTabs) {
          addTabToPatient(patientId, tab);
        }
        if (hadNoEncounterTabs) {
          // Auto-select most recent encounter
          const sorted = [...newTabs].sort((a, b) =>
            (b.visitDate || '').localeCompare(a.visitDate || '')
          );
          setActiveTabId(sorted[0].id);
        }
      }
    });
  }, [activePatient?.id, activePatient?.fhirId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch tasks from EMR when a FHIR patient is activated
  useEffect(() => {
    const patientId = activePatient?.id;
    const fhirId = activePatient?.fhirId;
    if (!fhirId || !patientId) return;
    if (loadedTasksRef.current.has(fhirId)) return;

    loadedTasksRef.current.add(fhirId);

    searchFhirTasks(fhirId).then((result) => {
      if (result.error) {
        // Allow retry on failure
        loadedTasksRef.current.delete(fhirId);
        return;
      }
      if (result.tasks.length === 0) return;

      const existingTaskFhirIds = new Set(
        (activePatient?.tabs || [])
          .filter((t) => t.taskFhirId)
          .map((t) => t.taskFhirId)
      );

      const newTabs: Tab[] = result.tasks
        .filter((task) => task.fhirId && !existingTaskFhirIds.has(task.fhirId))
        .map((task) => ({
          id: `task-${task.fhirId}`,
          name: task.description
            ? task.description.length > 40 ? task.description.slice(0, 40) + '…' : task.description
            : 'Task',
          content: task.description || '',
          section: 'tasks' as const,
          isTask: true,
          taskFhirId: task.fhirId,
        }));

      if (newTabs.length > 0) {
        for (const tab of newTabs) {
          addTabToPatient(patientId, tab);
        }
      }
    });
  }, [activePatient?.id, activePatient?.fhirId]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredTabs = useMemo(() => {
    if (!activePatient) return { pages: [], encounters: [], tasks: [] };

    const query = searchQuery.toLowerCase();
    const filtered = (activePatient.tabs ?? []).filter(tab =>
      tab.name.toLowerCase().includes(query)
    );

    // Sort starred items to the top while preserving relative order
    const starredFirst = (a: Tab, b: Tab) =>
      (b.starred ? 1 : 0) - (a.starred ? 1 : 0);

    return {
      pages: filtered.filter(tab => tab.section === 'pages').sort(starredFirst),
      encounters: filtered.filter(tab => tab.section === 'encounters').sort(starredFirst),
      tasks: filtered.filter(tab => tab.section === 'tasks').sort(starredFirst)
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
    // If deleting active tab, switch to first available tab or clear
    if (tabId === activeTabId) {
      const remainingTabs = activePatient.tabs.filter(t => t.id !== tabId);
      if (remainingTabs.length > 0) {
        setActiveTabId(remainingTabs[0].id);
      } else {
        setActiveTabId(null); // Clear active tab when deleting the last one
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
