'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FileText, Star, MoreVertical } from 'lucide-react';
import { TabItemData } from '@/lib/types/tab';
import { TabContextMenu } from './TabContextMenu';

interface TabItemProps {
  tab: TabItemData;
  isActive: boolean;
  onClick: () => void;
  onRename?: (newName: string) => void;
  onToggleStar?: () => void;
  onMarkAsEncounter?: () => void;
  onMarkAsTask?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onDragStart?: (tabId: string) => void;
  onDragOver?: (tabId: string, position: 'before' | 'after' | 'child') => void;
  onDragLeave?: () => void;
  onDrop?: (draggedTabId: string, targetTabId: string, position: 'before' | 'after' | 'child') => void;
  dragState?: {
    isDragging: boolean;
    draggedTabId: string | null;
    dropTarget: string | null;
    dropPosition: 'before' | 'after' | 'child' | null;
  };
}

export function TabItem({
  tab,
  isActive,
  onClick,
  onRename,
  onToggleStar,
  onMarkAsEncounter,
  onMarkAsTask,
  onDelete,
  onDuplicate,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  dragState
}: TabItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(tab.name);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    return `${month} ${day}`;
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditValue(tab.name);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (editValue.trim() && editValue !== tab.name && onRename) {
      onRename(editValue.trim());
    } else {
      setEditValue(tab.name);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setEditValue(tab.name);
      setIsEditing(false);
    }
  };

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleStar) {
      onToggleStar();
    }
  };

  const handleMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (moreButtonRef.current) {
      const rect = moreButtonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 5,
        left: rect.left
      });
      setShowMenu(true);
    }
  };

  const handleRenameFromMenu = () => {
    setIsEditing(true);
    setEditValue(tab.name);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tab.id);
    if (onDragStart) {
      onDragStart(tab.id);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (!itemRef.current || !onDragOver) return;

    const rect = itemRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    let position: 'before' | 'after' | 'child';

    // Determine drop position based on mouse Y position
    if (y < height * 0.25) {
      position = 'before';
    } else if (y > height * 0.75) {
      position = 'after';
    } else {
      position = 'child';
    }

    onDragOver(tab.id, position);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only trigger if leaving the item entirely
    if (!itemRef.current?.contains(e.relatedTarget as Node)) {
      if (onDragLeave) {
        onDragLeave();
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const draggedTabId = e.dataTransfer.getData('text/plain');

    if (!itemRef.current || !onDrop || !dragState) return;

    const rect = itemRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    let position: 'before' | 'after' | 'child';

    if (y < height * 0.25) {
      position = 'before';
    } else if (y > height * 0.75) {
      position = 'after';
    } else {
      position = 'child';
    }

    onDrop(draggedTabId, tab.id, position);
  };

  const isDragging = dragState?.isDragging && dragState.draggedTabId === tab.id;
  const isDropTarget = dragState?.dropTarget === tab.id;
  const dropPosition = dragState?.dropPosition;

  let dropIndicatorClass = '';
  if (isDropTarget && dropPosition) {
    if (dropPosition === 'before') {
      dropIndicatorClass = 'border-t-4 border-t-blue-500 bg-blue-50';
    } else if (dropPosition === 'after') {
      dropIndicatorClass = 'border-b-4 border-b-blue-500 bg-blue-50';
    } else if (dropPosition === 'child') {
      dropIndicatorClass = 'border-l-4 border-l-blue-500 bg-blue-100';
    }
  }

  return (
    <>
      <div
        ref={itemRef}
        draggable={!isEditing}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex items-center gap-2 px-3 py-2 mx-2 cursor-pointer text-sm rounded transition-colors group ${
          isActive
            ? 'bg-gray-100 text-gray-900'
            : 'text-gray-600 hover:bg-gray-50'
        } ${isDragging ? 'opacity-50' : ''} ${dropIndicatorClass}`}
        onClick={onClick}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <FileText size={14} className="text-gray-400 flex-shrink-0" />
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-white border border-blue-500 rounded px-1 focus:outline-none"
          />
        ) : (
          <span className="flex-1 truncate">{tab.name}</span>
        )}
        {tab.visitDate && !isEditing && (
          <span className="text-xs text-green-600 font-medium">{formatDate(tab.visitDate)}</span>
        )}
        {!isEditing && (isHovered || isActive || tab.starred) && (
          <button
            onClick={handleStarClick}
            className="p-0.5 hover:bg-gray-200 rounded"
          >
            <Star
              size={14}
              className={tab.starred ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400'}
            />
          </button>
        )}
        {!isEditing && (isHovered || isActive) && (
          <button
            ref={moreButtonRef}
            onClick={handleMoreClick}
            className="p-0.5 hover:bg-gray-200 rounded"
          >
            <MoreVertical size={14} className="text-gray-400" />
          </button>
        )}
      </div>
      {showMenu && (
        <TabContextMenu
          isStarred={!!tab.starred}
          isEncounter={!!tab.isVisit}
          isTask={!!tab.isTask}
          position={menuPosition}
          onClose={() => setShowMenu(false)}
          onToggleStar={() => onToggleStar?.()}
          onMarkAsEncounter={() => onMarkAsEncounter?.()}
          onMarkAsTask={() => onMarkAsTask?.()}
          onAddSubpage={() => console.log('Add subpage')}
          onDelete={() => onDelete?.()}
          onDuplicate={() => onDuplicate?.()}
          onRename={handleRenameFromMenu}
          onChooseEmoji={() => console.log('Choose emoji')}
          onCopyLink={() => console.log('Copy link')}
        />
      )}
    </>
  );
}
