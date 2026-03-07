'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { Layout } from 'react-resizable-panels';
import { PatientSummaryHeader } from '../editor/PatientSummaryHeader';
import { NoteEditor } from '../editor/NoteEditor';
import { SplitTabLayout } from './SplitTabLayout';
import { PatientInfoTab } from '../patient/PatientInfoTab';
import { MedicationsTab } from '../patient/MedicationsTab';
import { AllergiesTab } from '../patient/AllergiesTab';
import { LabsTab } from '../patient/LabsTab';
import { ImagingTab } from '../patient/ImagingTab';
import { MedicalHistoryTab } from '../patient/MedicalHistoryTab';
import { VitalsTab } from '../patient/VitalsTab';
import { SurgicalHistoryTab } from '../patient/SurgicalHistoryTab';
import { FamilyHistoryTab } from '../patient/FamilyHistoryTab';
import { SocialHistoryTab } from '../patient/SocialHistoryTab';
import { GoalsOfCareTab } from '../patient/GoalsOfCareTab';
import { CareTeamTab } from '../patient/CareTeamTab';
import { ReferralsTab } from '../patient/ReferralsTab';
import { EncounterMetadataBar } from '../patient/EncounterMetadataBar';
import { TaskMetadataBar } from '../patient/TaskMetadataBar';
import { PageMetadataBar } from '../patient/PageMetadataBar';
import { usePatient } from '@/lib/context/PatientContext';
import { useEditor } from '@/lib/context/EditorContext';

function StructuredPlaceholder() {
  return (
    <div className="flex items-center justify-center h-full text-gray-300 text-sm">
      No structured data for this tab yet
    </div>
  );
}

export function EditorContainer() {
  const { activePatient, updateTabProperties } = usePatient();
  const { activeTabId, leftPanelMode } = useEditor();

  // All hooks must be called before any early return (Rules of Hooks)
  const [showNote, setShowNote] = useState(false);
  const [labView, setLabView] = useState<'pending' | 'results'>('pending');
  const [labCounts, setLabCounts] = useState({ pending: 0, results: 0 });
  const [imagingView, setImagingView] = useState<'pending' | 'results'>('pending');
  const [imagingCounts, setImagingCounts] = useState({ pending: 0, results: 0 });
  const [referralView, setReferralView] = useState<'pending' | 'completed'>('pending');
  const [referralCounts, setReferralCounts] = useState({ pending: 0, completed: 0 });
  const [refreshKey, setRefreshKey] = useState(0);

  const activeTab = activePatient?.tabs.find(t => t.id === activeTabId);

  const isFhirPatient = !!activePatient?.fhirId;
  const isPatientInfoTab = activeTab?.name === 'Patient Info';
  const isMedicationsTab = activeTab?.name === 'Medications' && isFhirPatient;
  const isAllergiesTab = activeTab?.name === 'Allergies' && isFhirPatient;
  const isLabsTab = activeTab?.name === 'Labs' && isFhirPatient;
  const isImagingTab = activeTab?.name === 'Imaging' && isFhirPatient;
  const isMedicalHistoryTab = (activeTab?.name === 'Conditions' || activeTab?.name === 'Medical History') && isFhirPatient;
  const isVitalsTab = activeTab?.name === 'Vitals' && isFhirPatient;
  const isSurgicalHistoryTab = activeTab?.name === 'Surgical History' && isFhirPatient;
  const isFamilyHistoryTab = activeTab?.name === 'Family History' && isFhirPatient;
  const isSocialHistoryTab = activeTab?.name === 'Social History' && isFhirPatient;
  const isGoalsOfCareTab = activeTab?.name === 'Goals of Care' && isFhirPatient;
  const isCareTeamTab = activeTab?.name === 'Care Team' && isFhirPatient;
  const isReferralsTab = activeTab?.name === 'Referrals' && isFhirPatient;
  const isEncounterTab = activeTab?.section === 'encounters' && isFhirPatient;
  const isTaskTab = activeTab?.section === 'tasks' && isFhirPatient;

  // Determine which structured component to render in the top panel
  const structuredContent = useMemo(() => {
    if (isPatientInfoTab) return <PatientInfoTab />;
    if (isMedicationsTab) return <MedicationsTab refreshKey={refreshKey} />;
    if (isAllergiesTab) return <AllergiesTab refreshKey={refreshKey} />;
    if (isLabsTab) return <LabsTab labView={labView} onCountsChange={(pending, results) => setLabCounts({ pending, results })} refreshKey={refreshKey} />;
    if (isImagingTab) return <ImagingTab imagingView={imagingView} onCountsChange={(pending, results) => setImagingCounts({ pending, results })} refreshKey={refreshKey} />;
    if (isMedicalHistoryTab) return <MedicalHistoryTab refreshKey={refreshKey} />;
    if (isVitalsTab) return <VitalsTab refreshKey={refreshKey} />;
    if (isSurgicalHistoryTab) return <SurgicalHistoryTab refreshKey={refreshKey} />;
    if (isFamilyHistoryTab) return <FamilyHistoryTab refreshKey={refreshKey} />;
    if (isSocialHistoryTab) return <SocialHistoryTab refreshKey={refreshKey} />;
    if (isGoalsOfCareTab) return <GoalsOfCareTab refreshKey={refreshKey} />;
    if (isCareTeamTab) return <CareTeamTab refreshKey={refreshKey} />;
    if (isReferralsTab) return <ReferralsTab referralView={referralView} onCountsChange={(pending, completed) => setReferralCounts({ pending, completed })} refreshKey={refreshKey} />;
    // Encounters, tasks, and generic pages have no structured content yet
    return <StructuredPlaceholder />;
  }, [isPatientInfoTab, isMedicationsTab, isAllergiesTab, isLabsTab, labView, isImagingTab, imagingView, isMedicalHistoryTab, isVitalsTab, isSurgicalHistoryTab, isFamilyHistoryTab, isSocialHistoryTab, isGoalsOfCareTab, isCareTeamTab, isReferralsTab, referralView, refreshKey]);

  // Determine placeholder text for the note editor
  const editorPlaceholder = isEncounterTab
    ? 'Start typing your encounter notes here...'
    : isTaskTab
      ? 'Describe the task here...'
      : 'Start typing your notes here...';

  // Build default layout from stored divider position
  const defaultLayout = useMemo(() => {
    const leftSize = activeTab?.dividerPosition ?? 50;
    return { structured: leftSize, unstructured: 100 - leftSize };
  }, [activeTab?.dividerPosition]);

  // Persist divider position when user finishes dragging
  const handleLayoutChanged = useCallback((layout: Layout) => {
    if (!activePatient || !activeTabId) return;
    const leftSize = layout['structured'];
    if (leftSize !== undefined && leftSize !== activeTab?.dividerPosition) {
      updateTabProperties(activePatient.id, activeTabId, { dividerPosition: Math.round(leftSize) });
    }
  }, [activePatient, activeTabId, activeTab?.dividerPosition, updateTabProperties]);

  // Auto-rename encounter/task tabs from first line of content
  const handleContentChange = useCallback((plainText: string) => {
    if (!activePatient || !activeTabId || !activeTab) return;
    const fallback = activeTab.section === 'encounters' ? 'New Encounter' : 'New Task';
    const firstLine = plainText.split('\n')[0].trim();
    const autoName = firstLine
      ? firstLine.length > 40 ? firstLine.slice(0, 40) + '\u2026' : firstLine
      : fallback;
    if (activeTab.name !== autoName) {
      updateTabProperties(activePatient.id, activeTabId, { name: autoName });
    }
  }, [activePatient, activeTabId, activeTab]);

  // Hide editor when case library is shown as full page (clinician view)
  if (leftPanelMode === 'caseLibrary') return null;

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      <PatientSummaryHeader />

      {/* Encounter/Task metadata bars render above the split */}
      {isEncounterTab && <EncounterMetadataBar />}
      {isTaskTab && <TaskMetadataBar />}

      {isEncounterTab || isTaskTab ? (
        <div className="flex-1 overflow-hidden">
          <NoteEditor
            placeholder={editorPlaceholder}
            onContentChange={(isEncounterTab || isTaskTab) ? handleContentChange : undefined}
            readOnly={isEncounterTab && !!activeTab?.isSigned}
          />
        </div>
      ) : (
        <>
        <PageMetadataBar
          showNote={showNote}
          onToggleNote={() => setShowNote(v => !v)}
          onRefresh={() => setRefreshKey(k => k + 1)}
          {...(isLabsTab ? { labView, onLabViewChange: setLabView, labCounts } : {})}
          {...(isImagingTab ? { imagingView, onImagingViewChange: setImagingView, imagingCounts } : {})}
          {...(isReferralsTab ? { referralView, onReferralViewChange: setReferralView, referralCounts } : {})}
        />
        {showNote ? (
          <SplitTabLayout
            leftPanel={structuredContent}
            rightPanel={
              <NoteEditor
                placeholder={editorPlaceholder}
              />
            }
            defaultLayout={defaultLayout}
            onLayoutChanged={handleLayoutChanged}
          />
        ) : (
          <div className="flex-1 overflow-y-auto">
            {structuredContent}
          </div>
        )}
        </>
      )}
    </div>
  );
}
