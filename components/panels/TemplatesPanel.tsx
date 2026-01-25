'use client';

import React from 'react';
import { Pin, FileText } from 'lucide-react';
import { useSidebar } from '@/lib/context/SidebarContext';

export function TemplatesPanel() {
  const { templates } = useSidebar();

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm">Templates</h3>
        <p className="text-xs text-gray-500 mt-1">Reusable content templates</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {Object.entries(templates).map(([name, template]) => {
          const templateData = typeof template === 'string' ? { name, content: template } : template;
          const preview = templateData.content.replace(/<[^>]*>/g, '').substring(0, 200);

          return (
            <div key={name} className="border rounded-md p-3 hover:bg-gray-50 cursor-pointer">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {templateData.icon ? (
                    <span>{templateData.icon}</span>
                  ) : (
                    <FileText size={14} className="text-gray-400" />
                  )}
                  <span className="font-medium text-sm">{name}</span>
                  {templateData.isPinned && <Pin size={12} className="text-gray-400" />}
                </div>
              </div>
              <div className="text-xs text-gray-600 line-clamp-4">
                {preview}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
