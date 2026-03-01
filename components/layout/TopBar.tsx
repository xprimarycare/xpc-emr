'use client';

import React from 'react';
import { Menu, Users, Plus, Lightbulb, MessageCircle, Calendar, Columns } from 'lucide-react';
import { usePatient } from '@/lib/context/PatientContext';
import { useSidebar } from '@/lib/context/SidebarContext';
import { useEditor } from '@/lib/context/EditorContext';
import { PatientTabList } from '../patient/PatientTabList';
import { PatientSearch } from '@/components/patient/PatientSearch';
import { createDefaultTabs } from '@/lib/data/default-tabs';

export function TopBar() {
  const { addPatient } = usePatient();
  const { toggleRightPanel } = useSidebar();
  const { toggleLeftPanel } = useEditor();

  const handleNewPatient = () => {
    const newPatientId = `patient-${Date.now()}`;
    const tabs = createDefaultTabs({ name: 'New Patient', mrn: '', dob: '', sex: '' });
    const patientInfoTabId = tabs[0].id; // Patient Info is index 0

    addPatient({
      id: newPatientId,
      name: 'New Patient',
      mrn: '',
      dob: '',
      sex: '',
      summary: '',
      tabs,
    });

    // Set active tab to Patient Info so the form shows immediately
    setTimeout(() => {
      const event = new CustomEvent('setActiveTab', { detail: patientInfoTabId });
      window.dispatchEvent(event);
    }, 100);
  };

  return (
    <div className="border-b bg-white">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => toggleLeftPanel('sidebar')}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <Menu size={20} className="text-gray-600" />
          </button>
          <button
            onClick={() => toggleLeftPanel('patientList')}
            className="p-1 hover:bg-gray-100 rounded"
            title="Browse patients"
          >
            <Users size={20} className="text-gray-600" />
          </button>
          <PatientTabList />
          <button
            onClick={handleNewPatient}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <Plus size={20} className="text-gray-600" />
          </button>
        </div>
        <PatientSearch />
        <div className="flex items-center gap-2 shrink-0">
          <button
            className="p-2 hover:bg-gray-100 rounded"
            onClick={() => toggleRightPanel('ai')}
          >
            <Lightbulb size={20} className="text-gray-600" />
          </button>
          <button
            className="p-2 hover:bg-gray-100 rounded"
            onClick={() => toggleRightPanel('chat')}
          >
            <MessageCircle size={20} className="text-gray-600" />
          </button>
          <button
            className="p-2 hover:bg-gray-100 rounded"
            onClick={() => toggleRightPanel('calendar')}
          >
            <Calendar size={20} className="text-gray-600" />
          </button>
          <button
            className="p-2 hover:bg-gray-100 rounded"
            onClick={() => toggleRightPanel('orders')}
          >
            <Columns size={20} className="text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
}
