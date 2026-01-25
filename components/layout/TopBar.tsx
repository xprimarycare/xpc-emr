'use client';

import React from 'react';
import { Menu, Search, Plus, Lightbulb, Columns } from 'lucide-react';
import { usePatient } from '@/lib/context/PatientContext';
import { useSidebar } from '@/lib/context/SidebarContext';
import { useEditor } from '@/lib/context/EditorContext';
import { PatientTabList } from '../patient/PatientTabList';

export function TopBar() {
  const { addPatient } = usePatient();
  const { toggleRightPanel } = useSidebar();
  const { toggleLeftSidebar } = useEditor();

  const handleNewPatient = () => {
    const newPatientId = `patient-${Date.now()}`;
    const patientInfoTabId = `tab-${newPatientId}-2`;

    addPatient({
      id: newPatientId,
      name: 'New Patient',
      mrn: 'No info',
      dob: '',
      sex: '',
      summary: '',
      tabs: [
        {
          id: `tab-${newPatientId}-1`,
          name: 'Summary',
          content: '',
          section: 'pages'
        },
        {
          id: patientInfoTabId,
          name: 'Patient Info',
          content: '',
          section: 'pages'
        }
      ]
    });

    // Set active tab to Patient Info so the form shows immediately
    setTimeout(() => {
      const event = new CustomEvent('setActiveTab', { detail: patientInfoTabId });
      window.dispatchEvent(event);
    }, 100);
  };

  return (
    <div className="border-b bg-white">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleLeftSidebar}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <Menu size={20} className="text-gray-600" />
          </button>
          <PatientTabList />
          <button
            onClick={handleNewPatient}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <Plus size={20} className="text-gray-600" />
          </button>
          <div className="relative ml-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search patient.."
              className="pl-9 pr-4 py-1.5 bg-gray-50 border-0 rounded-md text-sm w-96 focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-gray-100 rounded">
            <Lightbulb size={20} className="text-gray-600" />
          </button>
          <button
            className="p-2 hover:bg-gray-100 rounded"
            onClick={() => toggleRightPanel('variables')}
          >
            <Columns size={20} className="text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
}
