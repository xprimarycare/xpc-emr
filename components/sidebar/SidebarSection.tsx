'use client';

import React from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { TabSection } from '@/lib/types/tab';
import { FileText, Calendar, CheckSquare } from 'lucide-react';

interface SidebarSectionProps {
  title: string;
  section: TabSection;
  collapsed: boolean;
  onToggle: () => void;
  onAddNew?: () => void;
  children: React.ReactNode;
}

const getSectionIcon = (section: TabSection) => {
  switch (section) {
    case 'pages':
      return <FileText size={14} />;
    case 'encounters':
      return <Calendar size={14} />;
    case 'tasks':
      return <CheckSquare size={14} />;
  }
};

const getSectionColor = (section: TabSection) => {
  switch (section) {
    case 'pages':
      return 'text-gray-600';
    case 'encounters':
      return 'text-green-600';
    case 'tasks':
      return 'text-blue-600';
  }
};

export function SidebarSection({
  title,
  section,
  collapsed,
  onToggle,
  onAddNew,
  children
}: SidebarSectionProps) {
  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAddNew) {
      onAddNew();
    }
  };

  return (
    <div className="mb-4">
      <div className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium">
        <span className={getSectionColor(section)}>{getSectionIcon(section)}</span>
        <span className={getSectionColor(section)}>{title}</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={handleAddClick}
            className="p-1 hover:bg-gray-100 rounded"
            title={`Add new ${section}`}
          >
            <Plus size={14} className="text-gray-400" />
          </button>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <ChevronDown
              size={14}
              className={`text-gray-400 transition-transform ${collapsed ? '-rotate-90' : ''}`}
            />
          </button>
        </div>
      </div>
      {!collapsed && <div className="mt-1">{children}</div>}
    </div>
  );
}
