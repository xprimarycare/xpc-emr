'use client';

import React from 'react';
import { Star, Calendar, CheckSquare, Plus, Trash2, Copy, Edit3, Smile, Link } from 'lucide-react';

interface TabContextMenuProps {
  isStarred: boolean;
  isEncounter: boolean;
  isTask: boolean;
  position: { top: number; left: number };
  onClose: () => void;
  onToggleStar: () => void;
  onMarkAsEncounter: () => void;
  onMarkAsTask: () => void;
  onAddSubpage: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onRename: () => void;
  onChooseEmoji: () => void;
  onCopyLink: () => void;
}

export function TabContextMenu({
  isStarred,
  isEncounter,
  isTask,
  position,
  onClose,
  onToggleStar,
  onMarkAsEncounter,
  onMarkAsTask,
  onAddSubpage,
  onDelete,
  onDuplicate,
  onRename,
  onChooseEmoji,
  onCopyLink
}: TabContextMenuProps) {
  const menuItems = [
    {
      icon: <Star size={18} />,
      label: isStarred ? 'Remove star' : 'Add star',
      onClick: onToggleStar
    },
    {
      icon: <Calendar size={18} />,
      label: isEncounter ? 'Unmark as encounter' : 'Mark as encounter',
      onClick: onMarkAsEncounter
    },
    {
      icon: <CheckSquare size={18} />,
      label: isTask ? 'Unmark as task' : 'Mark as task',
      onClick: onMarkAsTask
    },
    {
      icon: <Plus size={18} />,
      label: 'Add subpage',
      onClick: onAddSubpage
    },
    {
      icon: <Trash2 size={18} />,
      label: 'Delete',
      onClick: onDelete,
      danger: true
    },
    {
      icon: <Copy size={18} />,
      label: 'Duplicate',
      onClick: onDuplicate
    },
    {
      icon: <Edit3 size={18} />,
      label: 'Rename',
      onClick: onRename
    },
    {
      icon: <Smile size={18} />,
      label: 'Choose emoji',
      onClick: onChooseEmoji
    },
    {
      icon: <Link size={18} />,
      label: 'Copy link',
      onClick: onCopyLink
    }
  ];

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      <div
        className="fixed z-50 bg-white border rounded-lg shadow-lg py-2 min-w-[200px]"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`
        }}
      >
        {menuItems.map((item, index) => (
          <button
            key={index}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 ${
              item.danger ? 'text-red-600' : 'text-gray-700'
            }`}
          >
            <span className={item.danger ? 'text-red-600' : 'text-gray-500'}>
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
