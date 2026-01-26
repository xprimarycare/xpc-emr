'use client';

import React from 'react';
import { Pin, Plus } from 'lucide-react';
import { useSidebar } from '@/lib/context/SidebarContext';

export function TemplatesPanel() {
  const { templates } = useSidebar();

  // Sort templates: pinned first, then alphabetically
  const sortedTemplates = Object.entries(templates).sort(([, a], [, b]) => {
    const aData = typeof a === 'string' ? { isPinned: false } : a;
    const bData = typeof b === 'string' ? { isPinned: false } : b;
    if (aData.isPinned && !bData.isPinned) return -1;
    if (!aData.isPinned && bData.isPinned) return 1;
    return 0;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {sortedTemplates.map(([name, template]) => {
          const templateData = typeof template === 'string' ? { name, content: template, isPinned: false } : template;
          const preview = templateData.content.replace(/<[^>]*>/g, '').substring(0, 50);

          return (
            <div
              key={name}
              className={`border-b border-l-4 px-4 py-3 cursor-pointer hover:bg-gray-50 ${
                templateData.isPinned
                  ? 'bg-amber-50 border-l-amber-400'
                  : 'border-l-transparent'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-amber-700">#{name}</span>
                  <p className="text-sm text-gray-500 truncate mt-0.5">
                    {preview}...
                  </p>
                </div>
                {templateData.isPinned && (
                  <Pin size={14} className="text-amber-600 shrink-0 ml-2 mt-1" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 border-t">
        <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
          <Plus size={18} />
          Add Template
        </button>
      </div>
    </div>
  );
}
