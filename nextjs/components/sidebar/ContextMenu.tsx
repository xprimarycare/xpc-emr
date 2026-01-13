'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Star,
  CalendarCheck,
  CheckSquare,
  Plus,
  Trash2,
  Copy,
  Pencil,
  Link as LinkIcon,
} from 'lucide-react';
import type { Tab } from '@/lib/types';

interface ContextMenuProps {
  tab: Tab;
  onStar: () => void;
  onToggleVisit: () => void;
  onToggleTask: () => void;
  onAddSubtab: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onRename: () => void;
  children: React.ReactNode;
}

export function ContextMenu({
  tab,
  onStar,
  onToggleVisit,
  onToggleTask,
  onAddSubtab,
  onDelete,
  onDuplicate,
  onRename,
  children,
}: ContextMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem onClick={onStar}>
          <Star className={`h-4 w-4 mr-2 ${tab.starred ? 'fill-current' : ''}`} />
          {tab.starred ? 'Unstar page' : 'Star page'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onToggleVisit}>
          <CalendarCheck className="h-4 w-4 mr-2" />
          {tab.isVisit ? 'Unmark as encounter' : 'Mark as encounter'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onToggleTask}>
          <CheckSquare className="h-4 w-4 mr-2" />
          {tab.isTask ? 'Unmark as task' : 'Mark as task'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onAddSubtab}>
          <Plus className="h-4 w-4 mr-2" />
          Add subpage
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onRename}>
          <Pencil className="h-4 w-4 mr-2" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicate}>
          <Copy className="h-4 w-4 mr-2" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-red-600">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
