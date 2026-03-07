'use client';

import React from 'react';
import Link from 'next/link';
import { Menu, Users, Plus, Lightbulb, MessageCircle, Calendar, Columns, BookOpen } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { usePatient } from '@/lib/context/PatientContext';
import { useSidebar } from '@/lib/context/SidebarContext';
import { useEditor } from '@/lib/context/EditorContext';
import { PatientTabList } from '../patient/PatientTabList';
import { PatientSearch } from '@/components/patient/PatientSearch';
import { createDefaultTabs } from '@/lib/data/default-tabs';

export function TopBar() {
  const { user } = useAuth();
  const { update } = useSession();
  const router = useRouter();
  const { addPatient } = usePatient();
  const { toggleRightPanel } = useSidebar();
  const { toggleLeftPanel } = useEditor();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isImpersonating = !!(user as any)?.originalAdminId;

  const handleExitImpersonation = async () => {
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: null }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Server error ${res.status}`)
      }
      // Signal the JWT callback to restore admin identity
      await update({ stopImpersonating: true })
      router.push('/admin')
    } catch (err) {
      console.error('Failed to exit impersonation:', err)
    }
  }

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
    <div>
      {isImpersonating && (
        <div className="bg-amber-500 text-white px-4 py-1.5 text-sm flex items-center justify-center gap-3">
          <span>
            Viewing as <strong>{user?.name || user?.email}</strong>
          </span>
          <button
            onClick={handleExitImpersonation}
            className="bg-white text-amber-700 px-3 py-0.5 rounded text-xs font-semibold hover:bg-amber-50 transition-colors"
          >
            Exit Impersonation
          </button>
        </div>
      )}
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
            <button
              onClick={() => toggleLeftPanel('caseLibrary')}
              className="p-1 hover:bg-gray-100 rounded"
              title="Case Library"
            >
              <BookOpen size={20} className="text-gray-600" />
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
            <Link
              href="/account"
              className="flex items-center gap-2 pl-2 border-l border-gray-200 hover:opacity-80 transition-opacity"
            >
              {user?.image ? (
                <img
                  src={user.image}
                  alt={user.name || ''}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-xs font-medium text-gray-600">
                    {user?.name?.[0] || '?'}
                  </span>
                </div>
              )}
              <span className="text-sm text-gray-700 hidden md:inline">
                {user?.name || 'Unknown'}
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
