'use client';

import { ChevronDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  title: string;
  icon?: React.ReactNode;
  color?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onAdd?: () => void;
}

export function SectionHeader({
  title,
  icon,
  color = 'text-gray-500',
  collapsed = false,
  onToggleCollapse,
  onAdd,
}: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors group">
      {/* Collapse Button */}
      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className="p-0.5 hover:bg-gray-200 rounded"
        >
          <ChevronDown
            className={cn(
              'h-4 w-4 text-gray-400 transition-transform',
              collapsed && '-rotate-90'
            )}
          />
        </button>
      )}

      {/* Icon */}
      {icon && <div className={cn('flex-shrink-0', color)}>{icon}</div>}

      {/* Title */}
      <span className={cn('flex-1 text-xs font-semibold uppercase tracking-wide', color)}>
        {title}
      </span>

      {/* Add Button */}
      {onAdd && (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onAdd}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
