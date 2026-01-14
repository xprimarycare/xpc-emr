'use client';

import { useEffect, useState } from 'react';
import { initializeSampleData } from '@/data/seed-data';
import { TopBar } from '@/components/layout/TopBar';
import { LeftSidebar } from '@/components/layout/LeftSidebar';
import { RightSidebar } from '@/components/layout/RightSidebar';
import { PatientCreationDialog } from '@/components/patient/PatientCreationDialog';
import { PatientSummary } from '@/components/editor/PatientSummary';
import { RichEditor } from '@/components/editor/RichEditor';

export default function HomePage() {
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [activePatientId, setActivePatientId] = useState<string | null>(null);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [patientEditorOpen, setPatientEditorOpen] = useState(false);

  // Initialize sample data on mount
  useEffect(() => {
    initializeSampleData().then(() => {
      // Set the first patient as active
      setActivePatientId('patient-1');
      setActiveTabId('tab-1');
    });
  }, []);

  const handlePatientCreated = (patientId: string) => {
    setActivePatientId(patientId);
    setActiveTabId(null); // Reset active tab when switching to new patient
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white">
      {/* Top Bar */}
      <TopBar
        onToggleLeftSidebar={() => setLeftSidebarOpen(!leftSidebarOpen)}
        onToggleRightSidebar={() => setRightSidebarOpen(!rightSidebarOpen)}
        activePatientId={activePatientId}
        onPatientChange={setActivePatientId}
        onAddPatient={() => setPatientEditorOpen(true)}
      />

      {/* Patient Creation Dialog */}
      <PatientCreationDialog
        open={patientEditorOpen}
        onOpenChange={setPatientEditorOpen}
        onPatientCreated={handlePatientCreated}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        {leftSidebarOpen && (
          <LeftSidebar
            activePatientId={activePatientId}
            activeTabId={activeTabId}
            onTabChange={setActiveTabId}
          />
        )}

        {/* Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <PatientSummary patientId={activePatientId} />
          <RichEditor patientId={activePatientId} activeTabId={activeTabId} />
        </div>

        {/* Right Sidebar */}
        {rightSidebarOpen && (
          <RightSidebar
            activePatientId={activePatientId}
          />
        )}
      </div>
    </div>
  );
}
