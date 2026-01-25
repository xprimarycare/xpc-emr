'use client';

import React, { useState } from 'react';
import { Pin, Edit2, Check, X } from 'lucide-react';
import { useSidebar } from '@/lib/context/SidebarContext';

export function VariablesPanel() {
  const { variables, updateVariable } = useSidebar();
  const [editingVar, setEditingVar] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const startEdit = (name: string, content: string) => {
    setEditingVar(name);
    setEditContent(content);
  };

  const saveEdit = () => {
    if (editingVar) {
      updateVariable(editingVar, editContent);
      setEditingVar(null);
      setEditContent('');
    }
  };

  const cancelEdit = () => {
    setEditingVar(null);
    setEditContent('');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm">Variables</h3>
        <p className="text-xs text-gray-500 mt-1">Type @ in editor to insert</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {Object.entries(variables).map(([name, variable]) => {
          const varData = typeof variable === 'string' ? { name, content: variable } : variable;
          const isEditing = editingVar === name;
          const preview = varData.content.replace(/<[^>]*>/g, '').substring(0, 150);

          return (
            <div key={name} className="border rounded-md p-3 hover:bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {varData.icon && <span>{varData.icon}</span>}
                  <span className="font-mono text-sm text-blue-600">@{name}</span>
                  {varData.isPinned && <Pin size={12} className="text-gray-400" />}
                </div>
                {!isEditing && (
                  <button
                    onClick={() => startEdit(name, varData.content)}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    <Edit2 size={14} />
                  </button>
                )}
              </div>

              {isEditing ? (
                <div>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full p-2 border rounded text-xs font-mono h-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={saveEdit}
                      className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                    >
                      <Check size={12} /> Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="flex items-center gap-1 px-2 py-1 bg-gray-200 text-xs rounded hover:bg-gray-300"
                    >
                      <X size={12} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-600 line-clamp-3">
                  {preview}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
