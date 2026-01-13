'use client';

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FileText, Calendar, ChevronDown, Star, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ContextMenu } from './ContextMenu';
import { cn } from '@/lib/utils';
import type { Tab } from '@/lib/types';

interface TabItemProps {
  tab: Tab;
  active: boolean;
  onClick: () => void;
  onUpdate: (updates: Partial<Tab>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onAddSubtab: () => void;
  hasChildren?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function TabItem({
  tab,
  active,
  onClick,
  onUpdate,
  onDelete,
  onDuplicate,
  onAddSubtab,
  hasChildren,
  isExpanded,
  onToggleExpand,
}: TabItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(tab.name);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleRename = () => {
    setIsEditing(true);
    setEditValue(tab.name);
  };

  const handleSaveRename = () => {
    if (editValue.trim()) {
      onUpdate({ name: editValue.trim() });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveRename();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(tab.name);
    }
  };

  const icon = tab.isVisit ? (
    <div className="h-7 w-7 rounded-md bg-emerald-100 flex items-center justify-center flex-shrink-0">
      <Calendar className="h-4 w-4 text-emerald-600" />
    </div>
  ) : (
    <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-md group relative',
        active ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100',
        tab.isSubtab && 'pl-8'
      )}
    >
      {/* Expand/Collapse Button */}
      {hasChildren ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand?.();
          }}
          className="p-0.5 hover:bg-gray-200 rounded transition-transform"
        >
          <ChevronDown
            className={cn(
              'h-4 w-4 text-gray-500 transition-transform',
              !isExpanded && '-rotate-90'
            )}
          />
        </button>
      ) : (
        <div className="w-4" />
      )}

      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing"
      >
        {icon}
      </div>

      {/* Tab Name / Edit Input */}
      {isEditing ? (
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSaveRename}
          onKeyDown={handleKeyDown}
          className="h-7 text-sm flex-1"
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <button
          onClick={onClick}
          className="flex-1 text-left text-sm truncate"
        >
          {tab.name}
        </button>
      )}

      {/* Star Button */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity',
          tab.starred && 'opacity-100 text-yellow-500'
        )}
        onClick={(e) => {
          e.stopPropagation();
          onUpdate({ starred: !tab.starred });
        }}
      >
        <Star className={cn('h-3.5 w-3.5', tab.starred && 'fill-current')} />
      </Button>

      {/* Context Menu */}
      <ContextMenu
        tab={tab}
        onStar={() => onUpdate({ starred: !tab.starred })}
        onToggleVisit={() => onUpdate({ isVisit: !tab.isVisit })}
        onToggleTask={() => onUpdate({ isTask: !tab.isTask })}
        onAddSubtab={onAddSubtab}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onRename={handleRename}
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </Button>
      </ContextMenu>
    </div>
  );
}
