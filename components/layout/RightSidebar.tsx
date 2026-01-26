'use client';

import React from 'react';
import { X, Code, FileText, Lightbulb, Play } from 'lucide-react';
import { useSidebar } from '@/lib/context/SidebarContext';
import { OrdersPanel } from '../panels/OrdersPanel';
import { VariablesPanel } from '../panels/VariablesPanel';
import { TemplatesPanel } from '../panels/TemplatesPanel';
import { AIPanel } from '../panels/AIPanel';

export function RightSidebar() {
  const { rightPanelOpen, rightPanelType, toggleRightPanel, setRightPanelType } = useSidebar();

  if (!rightPanelOpen) {
    return null;
  }

  // AI Panel takes over the entire sidebar
  if (rightPanelType === 'ai') {
    return (
      <div className="w-80 border-l bg-white flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2 text-violet-500 font-medium">
            <Lightbulb size={18} />
            AI Assistant
          </div>
          <button
            onClick={() => toggleRightPanel()}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <AIPanel />
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 border-l bg-white flex flex-col">
      <div className="flex items-center border-b px-4 py-3 gap-6">
        <button
          onClick={() => setRightPanelType('orders')}
          className={`p-2 rounded ${
            rightPanelType === 'orders'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
          title="Actions"
        >
          <Play size={18} />
        </button>
        <button
          onClick={() => setRightPanelType('variables')}
          className={`p-2 rounded ${
            rightPanelType === 'variables'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
          title="Variables"
        >
          <Code size={18} />
        </button>
        <button
          onClick={() => setRightPanelType('templates')}
          className={`p-2 rounded ${
            rightPanelType === 'templates'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
          title="Templates"
        >
          <FileText size={18} />
        </button>
        <div className="flex-1" />
        <button
          onClick={() => toggleRightPanel()}
          className="p-2 hover:bg-gray-100 rounded"
        >
          <X size={16} className="text-gray-500" />
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {rightPanelType === 'orders' && <OrdersPanel />}
        {rightPanelType === 'variables' && <VariablesPanel />}
        {rightPanelType === 'templates' && <TemplatesPanel />}
      </div>
    </div>
  );
}
