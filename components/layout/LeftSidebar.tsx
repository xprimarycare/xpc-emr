'use client';

import { useState, useMemo } from 'react';
import { useTabs, useSaveTabs, useSaveTab, useDeleteTab } from '@/hooks/useTabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TabItem } from '@/components/sidebar/TabItem';
import { SectionHeader } from '@/components/sidebar/SectionHeader';
import { FileText, Calendar, CheckSquare } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { Tab } from '@/lib/types';

interface LeftSidebarProps {
  activePatientId: string | null;
  activeTabId: string | null;
  onTabChange: (tabId: string) => void;
}

export function LeftSidebar({
  activePatientId,
  activeTabId,
  onTabChange,
}: LeftSidebarProps) {
  const { data: tabs = [], isLoading } = useTabs(activePatientId);
  const saveTabs = useSaveTabs();
  const saveTab = useSaveTab();
  const deleteTab = useDeleteTab();

  const [expandedTabs, setExpandedTabs] = useState<Set<string>>(new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Configure drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Organize tabs into categories
  const { regularTabs, visitTabs, taskTabs } = useMemo(() => {
    const regular: Tab[] = [];
    const visits: Tab[] = [];
    const tasks: Tab[] = [];

    tabs.forEach((tab) => {
      if (tab.isVisit) {
        visits.push(tab);
      } else if (tab.isTask) {
        tasks.push(tab);
      } else if (!tab.isSubtab) {
        regular.push(tab);
      }
    });

    return {
      regularTabs: regular,
      visitTabs: visits,
      taskTabs: tasks,
    };
  }, [tabs]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !activePatientId) return;

    const oldIndex = tabs.findIndex((t) => t.id === active.id);
    const newIndex = tabs.findIndex((t) => t.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newTabs = [...tabs];
    const [movedTab] = newTabs.splice(oldIndex, 1);
    newTabs.splice(newIndex, 0, movedTab);

    saveTabs.mutate({ patientId: activePatientId, tabs: newTabs });
  };

  const handleUpdateTab = (tabId: string, updates: Partial<Tab>) => {
    if (!activePatientId) return;

    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;

    const updatedTab = { ...tab, ...updates };
    saveTab.mutate({ patientId: activePatientId, tab: updatedTab });
  };

  const handleDeleteTab = (tabId: string) => {
    if (!activePatientId) return;

    // If deleting active tab, switch to first tab
    if (activeTabId === tabId && tabs.length > 1) {
      const remainingTabs = tabs.filter((t) => t.id !== tabId);
      if (remainingTabs[0]) {
        onTabChange(remainingTabs[0].id);
      }
    }

    deleteTab.mutate({ patientId: activePatientId, tabId });
  };

  const handleDuplicateTab = (tabId: string) => {
    if (!activePatientId) return;

    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;

    const newTab: Tab = {
      ...tab,
      id: `tab-${Date.now()}`,
      name: `${tab.name} (Copy)`,
    };

    saveTab.mutate({ patientId: activePatientId, tab: newTab });
  };

  const handleAddSubtab = (parentId: string) => {
    if (!activePatientId) return;

    const newTab: Tab = {
      id: `tab-${Date.now()}`,
      name: 'New Subpage',
      content: '',
      parentId,
      isSubtab: true,
      expanded: true,
      starred: false,
      isVisit: false,
      isTask: false,
      visitDate: null,
    };

    saveTab.mutate({ patientId: activePatientId, tab: newTab });
    setExpandedTabs((prev) => new Set(prev).add(parentId));
  };

  const handleAddTab = () => {
    if (!activePatientId) return;

    const newTab: Tab = {
      id: `tab-${Date.now()}`,
      name: 'New Page',
      content: '',
      parentId: null,
      isSubtab: false,
      expanded: true,
      starred: false,
      isVisit: false,
      isTask: false,
      visitDate: null,
    };

    saveTab.mutate({ patientId: activePatientId, tab: newTab });
  };

  const handleAddEncounter = () => {
    if (!activePatientId) return;

    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const newTab: Tab = {
      id: `tab-${Date.now()}`,
      name: dateStr,
      content: '',
      parentId: null,
      isSubtab: false,
      expanded: true,
      starred: false,
      isVisit: true,
      isTask: false,
      visitDate: new Date().toISOString(),
      autoTitle: true,
    };

    saveTab.mutate({ patientId: activePatientId, tab: newTab });
  };

  const handleAddTask = () => {
    if (!activePatientId) return;

    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const newTab: Tab = {
      id: `tab-${Date.now()}`,
      name: dateStr,
      content: '',
      parentId: null,
      isSubtab: false,
      expanded: true,
      starred: false,
      isVisit: false,
      isTask: true,
      visitDate: new Date().toISOString(),
      autoTitle: true,
    };

    saveTab.mutate({ patientId: activePatientId, tab: newTab });
  };

  const toggleExpand = (tabId: string) => {
    setExpandedTabs((prev) => {
      const next = new Set(prev);
      if (next.has(tabId)) {
        next.delete(tabId);
      } else {
        next.add(tabId);
      }
      return next;
    });
  };

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const renderTab = (tab: Tab) => {
    const hasChildren = tabs.some((t) => t.parentId === tab.id);
    const isExpanded = expandedTabs.has(tab.id);
    const children = tabs.filter((t) => t.parentId === tab.id);

    return (
      <div key={tab.id}>
        <TabItem
          tab={tab}
          active={activeTabId === tab.id}
          onClick={() => onTabChange(tab.id)}
          onUpdate={(updates) => handleUpdateTab(tab.id, updates)}
          onDelete={() => handleDeleteTab(tab.id)}
          onDuplicate={() => handleDuplicateTab(tab.id)}
          onAddSubtab={() => handleAddSubtab(tab.id)}
          hasChildren={hasChildren}
          isExpanded={isExpanded}
          onToggleExpand={() => toggleExpand(tab.id)}
        />
        {hasChildren && isExpanded && (
          <div className="ml-4">
            {children.map((child) => renderTab(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <div className="text-sm text-gray-500 px-4 py-2">Loading...</div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              {/* Regular Pages Section */}
              {regularTabs.length > 0 && (
                <div className="mb-4">
                  <SectionHeader
                    title="Pages"
                    icon={<FileText className="h-3.5 w-3.5" />}
                    collapsed={collapsedSections.has('pages')}
                    onToggleCollapse={() => toggleSection('pages')}
                    onAdd={handleAddTab}
                  />
                  {!collapsedSections.has('pages') && (
                    <SortableContext
                      items={regularTabs.map((t) => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {regularTabs.map((tab) => renderTab(tab))}
                    </SortableContext>
                  )}
                </div>
              )}

              {/* Encounters Section */}
              {visitTabs.length > 0 && (
                <div className="mb-4">
                  <SectionHeader
                    title="Encounters"
                    icon={<Calendar className="h-3.5 w-3.5" />}
                    color="text-emerald-600"
                    collapsed={collapsedSections.has('encounters')}
                    onToggleCollapse={() => toggleSection('encounters')}
                    onAdd={handleAddEncounter}
                  />
                  {!collapsedSections.has('encounters') && (
                    <SortableContext
                      items={visitTabs.map((t) => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {visitTabs.map((tab) => renderTab(tab))}
                    </SortableContext>
                  )}
                </div>
              )}

              {/* Tasks Section */}
              {taskTabs.length > 0 && (
                <div className="mb-4">
                  <SectionHeader
                    title="Tasks"
                    icon={<CheckSquare className="h-3.5 w-3.5" />}
                    color="text-blue-600"
                    collapsed={collapsedSections.has('tasks')}
                    onToggleCollapse={() => toggleSection('tasks')}
                    onAdd={handleAddTask}
                  />
                  {!collapsedSections.has('tasks') && (
                    <SortableContext
                      items={taskTabs.map((t) => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {taskTabs.map((tab) => renderTab(tab))}
                    </SortableContext>
                  )}
                </div>
              )}
            </DndContext>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
