'use client';

import React from 'react';
import { X, Package, FileText, Clipboard } from 'lucide-react';
import { useSidebar } from '@/lib/context/SidebarContext';
import { OrdersPanel } from '../panels/OrdersPanel';
import { VariablesPanel } from '../panels/VariablesPanel';
import { TemplatesPanel } from '../panels/TemplatesPanel';

export function RightSidebar() {
  const { rightPanelOpen, rightPanelType, toggleRightPanel, setRightPanelType } = useSidebar();

  if (!rightPanelOpen) {
    return (
      <div className="w-12 border-l bg-gray-50 flex flex-col items-center py-4 gap-2">
        <button
          onClick={() => toggleRightPanel('orders')}
          className="p-2 hover:bg-gray-200 rounded-md"
          title="Orders"
        >
          <Clipboard size={20} />
        </button>
        <button
          onClick={() => toggleRightPanel('variables')}
          className="p-2 hover:bg-gray-200 rounded-md"
          title="Variables"
        >
          <Package size={20} />
        </button>
        <button
          onClick={() => toggleRightPanel('templates')}
          className="p-2 hover:bg-gray-200 rounded-md"
          title="Templates"
        >
          <FileText size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 border-l bg-white flex flex-col">
      <div className="flex items-center border-b">
        <button
          onClick={() => setRightPanelType('orders')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium ${
            rightPanelType === 'orders'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Clipboard size={16} />
          Orders
        </button>
        <button
          onClick={() => setRightPanelType('variables')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium ${
            rightPanelType === 'variables'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Package size={16} />
          Variables
        </button>
        <button
          onClick={() => setRightPanelType('templates')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium ${
            rightPanelType === 'templates'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <FileText size={16} />
          Templates
        </button>
        <button
          onClick={() => toggleRightPanel()}
          className="p-3 hover:bg-gray-100"
        >
          <X size={16} />
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
