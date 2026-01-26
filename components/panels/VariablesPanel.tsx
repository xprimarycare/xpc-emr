'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Plus, Pin } from 'lucide-react';
import { useSidebar } from '@/lib/context/SidebarContext';

function extractTitle(content: string): string {
  // Try to extract the first bold text as title
  const match = content.match(/<strong>([^<]+)<\/strong>/);
  if (match) return match[1];
  // Fallback: first line of text
  const text = content.replace(/<[^>]*>/g, '').trim();
  const firstLine = text.split('\n')[0];
  return firstLine.substring(0, 30);
}

function extractPreviewLines(content: string): string[] {
  // Remove HTML and split into lines
  const text = content.replace(/<[^>]*>/g, '').trim();
  const lines = text.split('\n').filter(line => line.trim());
  // Skip the title line (first one) and get bullet points
  const bulletLines = lines.slice(1).filter(line => line.startsWith('•') || line.startsWith('-'));
  // Return first 2 bullet points, cleaned up
  return bulletLines.slice(0, 2).map(line => {
    const cleaned = line.replace(/^[•-]\s*/, '').trim();
    return cleaned.length > 25 ? cleaned.substring(0, 25) + '...' : cleaned;
  });
}

function htmlToPlainText(html: string): string {
  let text = html.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<p[^>]*>/gi, '');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

function plainTextToHtml(text: string): string {
  const paragraphs = text.split('\n\n');
  return paragraphs.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
}

export function VariablesPanel() {
  const { variables, addVariable, updateVariable, deleteVariable, toggleVariablePin } = useSidebar();
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [contentInput, setContentInput] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing) {
      // Scroll to top when editing starts
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Focus name input for new variables
      if (!editingName && nameInputRef.current) {
        nameInputRef.current.focus();
      }
    }
  }, [isEditing, editingName]);

  const handleAddNew = () => {
    setIsEditing(true);
    setEditingName(null);
    setNameInput('');
    setContentInput('');
    setIsPinned(false);
  };

  const handleEdit = (name: string) => {
    const varData = variables[name];
    const content = typeof varData === 'string' ? varData : varData.content;
    const pinned = typeof varData === 'string' ? false : varData.isPinned || false;
    setIsEditing(true);
    setEditingName(name);
    setNameInput(name);
    setContentInput(htmlToPlainText(content));
    setIsPinned(pinned);
  };

  const handleTogglePin = () => {
    if (editingName) {
      toggleVariablePin(editingName);
      setIsPinned(!isPinned);
    } else {
      setIsPinned(!isPinned);
    }
  };

  const handleSave = () => {
    if (!nameInput.trim()) return;

    const htmlContent = plainTextToHtml(contentInput);

    if (editingName) {
      // Update existing
      updateVariable(editingName, htmlContent);
    } else {
      // Add new
      addVariable(nameInput.trim().toLowerCase().replace(/\s+/g, '_'), htmlContent);
    }

    setIsEditing(false);
    setEditingName(null);
    setNameInput('');
    setContentInput('');
  };

  const handleDelete = () => {
    if (editingName) {
      deleteVariable(editingName);
      setIsEditing(false);
      setEditingName(null);
      setNameInput('');
      setContentInput('');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingName(null);
    setNameInput('');
    setContentInput('');
    setIsPinned(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {/* Editor Form */}
        {isEditing && (
          <div ref={editorRef} className="p-4 border-b bg-gray-50">
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Variable Name</label>
              <div className="flex gap-2">
                <input
                  ref={nameInputRef}
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g., allergies"
                  readOnly={!!editingName}
                  className={`flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-400 ${editingName ? 'bg-gray-100' : ''}`}
                />
                <button
                  onClick={handleTogglePin}
                  title={isPinned ? 'Unpin variable' : 'Pin variable'}
                  className={`p-2 rounded-md border transition-colors ${
                    isPinned
                      ? 'bg-amber-100 border-amber-300 text-amber-600'
                      : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-100'
                  }`}
                >
                  <Pin size={18} />
                </button>
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Content</label>
              <textarea
                value={contentInput}
                onChange={(e) => setContentInput(e.target.value)}
                placeholder="Enter variable content..."
                rows={5}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm resize-none focus:outline-none focus:border-blue-400"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600"
              >
                Save
              </button>
              {editingName && (
                <button
                  onClick={handleDelete}
                  className="px-3 py-1.5 bg-red-100 text-red-600 text-sm rounded-md hover:bg-red-200"
                >
                  Delete
                </button>
              )}
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Variables List */}
        {Object.entries(variables)
          .sort(([, a], [, b]) => {
            const aData = typeof a === 'string' ? { isPinned: false } : a;
            const bData = typeof b === 'string' ? { isPinned: false } : b;
            if (aData.isPinned && !bData.isPinned) return -1;
            if (!aData.isPinned && bData.isPinned) return 1;
            return 0;
          })
          .map(([name, variable]) => {
          const varData = typeof variable === 'string' ? { name, content: variable, isPinned: false } : variable;
          const title = extractTitle(varData.content);
          const previewLines = extractPreviewLines(varData.content);
          const pinned = varData.isPinned || false;

          return (
            <div
              key={name}
              onClick={() => handleEdit(name)}
              className={`border-b border-l-4 px-4 py-3 cursor-pointer hover:bg-gray-50 ${
                pinned ? 'border-l-amber-400 bg-amber-50' : 'border-l-transparent'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-medium text-blue-600">@{name}</div>
                {pinned && <Pin size={14} className="text-amber-500" />}
              </div>
              <div className="text-sm font-semibold text-gray-600 mt-1">{title}</div>
              {previewLines.map((line, idx) => (
                <div key={idx} className="text-sm text-gray-500">
                  • {line}
                </div>
              ))}
              {previewLines.length > 0 && (
                <div className="text-sm text-gray-400">...</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-4 border-t">
        <button
          onClick={handleAddNew}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
        >
          <Plus size={18} />
          Add Variable
        </button>
      </div>
    </div>
  );
}
