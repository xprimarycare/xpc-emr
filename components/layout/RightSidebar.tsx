'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Code, FileText, Lightbulb } from 'lucide-react';
import { OrdersPanel } from '@/components/panels/OrdersPanel';
import { VariablesPanel } from '@/components/panels/VariablesPanel';
import { TemplatesPanel } from '@/components/panels/TemplatesPanel';
import { AIPanel } from '@/components/panels/AIPanel';

interface RightSidebarProps {
  activePatientId: string | null;
}

export function RightSidebar({ activePatientId }: RightSidebarProps) {
  const [activePanel, setActivePanel] = useState('orders');

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">Actions</h3>
      </div>

      {/* Panel Tabs */}
      <Tabs value={activePanel} onValueChange={setActivePanel} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="w-full rounded-none border-b border-gray-200 bg-transparent p-0 h-auto flex-shrink-0">
          <TabsTrigger
            value="orders"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-4 py-2"
          >
            <Play className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger
            value="variables"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-4 py-2"
          >
            <Code className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger
            value="templates"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-4 py-2"
          >
            <FileText className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger
            value="ai"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-4 py-2"
          >
            <Lightbulb className="h-4 w-4" />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="flex-1 m-0 overflow-hidden">
          <OrdersPanel />
        </TabsContent>

        <TabsContent value="variables" className="flex-1 m-0 overflow-hidden">
          <VariablesPanel patientId={activePatientId} />
        </TabsContent>

        <TabsContent value="templates" className="flex-1 m-0 overflow-hidden">
          <TemplatesPanel />
        </TabsContent>

        <TabsContent value="ai" className="flex-1 m-0 overflow-hidden">
          <AIPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
