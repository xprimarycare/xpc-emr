'use client';

import { useState } from 'react';
import { useVariables, useSaveVariables } from '@/hooks/useVariables';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pin, Trash2, Edit } from 'lucide-react';
import type { Variables, Variable } from '@/lib/types';

interface VariablesPanelProps {
  patientId: string | null;
}

export function VariablesPanel({ patientId }: VariablesPanelProps) {
  const { data } = useVariables(patientId);
  const variables: Variables = data || {};
  const saveVariables = useSaveVariables();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editContent, setEditContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);

  const getVariableContent = (varData: string | Variable): string => {
    return typeof varData === 'string' ? varData : varData.content;
  };

  const isVariablePinned = (varData: string | Variable): boolean => {
    return typeof varData === 'object' && varData.isPinned === true;
  };

  const startEditing = (key: string) => {
    const varData = variables[key];
    if (!varData) return;
    setEditingKey(key);
    setEditName(key);
    setEditContent(getVariableContent(varData));
    setIsPinned(isVariablePinned(varData));
  };

  const startCreating = () => {
    setEditingKey('__new__');
    setEditName('');
    setEditContent('');
    setIsPinned(false);
  };

  const cancelEditing = () => {
    setEditingKey(null);
    setEditName('');
    setEditContent('');
    setIsPinned(false);
  };

  const saveVariable = () => {
    if (!patientId || !editName.trim() || !editContent.trim()) return;

    const normalizedName = editName.trim().toLowerCase().replace(/\s+/g, '_');
    const newVariables: Variables = { ...variables };

    // If renaming, delete old key
    if (editingKey && editingKey !== '__new__' && editingKey !== normalizedName) {
      delete newVariables[editingKey];
    }

    // Save new/updated variable
    newVariables[normalizedName] = isPinned
      ? { content: editContent, isPinned: true }
      : editContent;

    saveVariables.mutate({ patientId, variables: newVariables });
    cancelEditing();
  };

  const deleteVariable = (key: string) => {
    if (!patientId) return;

    const newVariables: Variables = { ...variables };
    delete newVariables[key];

    saveVariables.mutate({ patientId, variables: newVariables });
  };

  const togglePin = (key: string) => {
    if (!patientId) return;

    const varData = variables[key];
    const content = getVariableContent(varData);
    const pinned = isVariablePinned(varData);

    const newVariables: Variables = {
      ...variables,
      [key]: pinned ? content : { content, isPinned: true },
    };

    saveVariables.mutate({ patientId, variables: newVariables });
  };

  const variableEntries = Object.entries(variables).sort(([keyA, valA], [keyB, valB]) => {
    const pinnedA = isVariablePinned(valA);
    const pinnedB = isVariablePinned(valB);
    if (pinnedA && !pinnedB) return -1;
    if (!pinnedA && pinnedB) return 1;
    return keyA.localeCompare(keyB);
  });

  return (
    <div className="flex flex-col h-full">
      {/* Editor */}
      {editingKey && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">
                Variable Name
              </label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="variable_name"
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">
                Content
              </label>
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Variable content..."
                rows={4}
                className="text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPinned(!isPinned)}
                className={isPinned ? 'bg-yellow-50 border-yellow-300' : ''}
              >
                <Pin className={`h-3.5 w-3.5 mr-1.5 ${isPinned ? 'fill-current text-yellow-600' : ''}`} />
                {isPinned ? 'Pinned' : 'Pin'}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveVariable} className="flex-1">
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={cancelEditing} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Variables List */}
      <div className="flex-1 overflow-y-auto">
        {variableEntries.length === 0 ? (
          <div className="p-4 text-center text-gray-400 text-sm">
            <p>No variables yet</p>
            <p className="text-xs mt-1">Create reusable text snippets</p>
          </div>
        ) : (
          <div>
            {variableEntries.map(([key, varData]) => {
              const content = getVariableContent(varData);
              const pinned = isVariablePinned(varData);

              return (
                <div
                  key={key}
                  className={`flex items-start gap-2 p-3 border-b border-gray-100 hover:bg-gray-50 group ${
                    pinned ? 'bg-yellow-50/50' : ''
                  }`}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-6 w-6 flex-shrink-0 mt-0.5 ${
                      pinned ? 'text-yellow-600' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    onClick={() => togglePin(key)}
                  >
                    <Pin className={`h-3.5 w-3.5 ${pinned ? 'fill-current' : ''}`} />
                  </Button>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-blue-700">{key}</div>
                    <div
                      className="text-xs text-gray-600 mt-0.5 line-clamp-2"
                      dangerouslySetInnerHTML={{ __html: content }}
                    />
                  </div>
                  <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => startEditing(key)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:text-red-600"
                      onClick={() => deleteVariable(key)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Button */}
      {!editingKey && (
        <div className="p-3 border-t border-gray-200">
          <Button onClick={startCreating} className="w-full" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Variable
          </Button>
        </div>
      )}
    </div>
  );
}
