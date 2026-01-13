'use client';

import { Menu, Search, Lightbulb, PanelRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PatientTabs } from '@/components/patient/PatientTabs';
import { useState } from 'react';

interface TopBarProps {
  onToggleLeftSidebar: () => void;
  onToggleRightSidebar: () => void;
  activePatientId: string | null;
  onPatientChange: (patientId: string) => void;
  onAddPatient: () => void;
}

export function TopBar({
  onToggleLeftSidebar,
  onToggleRightSidebar,
  activePatientId,
  onPatientChange,
  onAddPatient,
}: TopBarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3">
      {/* Menu Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full h-9 w-9"
        onClick={onToggleLeftSidebar}
        title="Toggle sidebar"
      >
        <Menu className="h-5 w-5 text-gray-700" />
      </Button>

      {/* Patient Tabs */}
      <PatientTabs
        activePatientId={activePatientId}
        onPatientChange={onPatientChange}
        onAddPatient={onAddPatient}
      />

      {/* Search Bar */}
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
        <Input
          type="text"
          placeholder="Search patient..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-gray-50 border-gray-200 rounded-full"
        />
      </div>

      {/* Right Actions */}
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full h-9 w-9"
        title="AI Query"
      >
        <Lightbulb className="h-5 w-5 text-gray-700" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="rounded-full h-9 w-9"
        onClick={onToggleRightSidebar}
        title="Toggle side panel"
      >
        <PanelRight className="h-5 w-5 text-gray-700" />
      </Button>
    </div>
  );
}
