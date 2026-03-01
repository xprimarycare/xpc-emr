'use client';

import React from 'react';
import { useSidebar } from '@/lib/context/SidebarContext';
import { Variable } from '@/lib/types/variable';

interface VariableAutocompleteProps {
  query: string;
  position: { top: number; left: number };
  onSelect: (variableName: string, content: string) => void;
  onClose: () => void;
}

export function VariableAutocomplete({
  query,
  position,
  onSelect,
  onClose
}: VariableAutocompleteProps) {
  const { variables } = useSidebar();

  const filteredVariables = Object.entries(variables).filter(([name]) =>
    name.toLowerCase().includes(query.toLowerCase())
  );

  if (filteredVariables.length === 0) {
    return null;
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      <div
        className="fixed z-50 bg-white border rounded-lg shadow-lg overflow-hidden"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          maxWidth: '300px',
          maxHeight: '300px',
          overflowY: 'auto'
        }}
      >
        {filteredVariables.map(([name, variable]) => {
          const varData: Variable = typeof variable === 'string' 
            ? { name, content: variable } 
            : variable;
          const preview = varData.content.replace(/<[^>]*>/g, '').substring(0, 100);
          return (
            <button
              key={name}
              onClick={() => onSelect(name, varData.content)}
              className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b last:border-b-0"
            >
              <div className="flex items-center gap-2">
                {varData.icon && <span className="text-lg">{varData.icon}</span>}
                <span className="font-mono text-sm text-blue-600">@{name}</span>
              </div>
              <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                {preview}...
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
