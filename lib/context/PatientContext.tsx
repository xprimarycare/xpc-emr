'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { PatientData } from '../types/patient';
import { mockPatients } from '../data/mock-patients';

interface PatientContextType {
  patients: PatientData[];
  activePatientId: string | null;
  activePatient: PatientData | null;
  setActivePatientId: (id: string) => void;
  addPatient: (patient: PatientData) => void;
  removePatient: (id: string) => void;
  updatePatient: (id: string, updates: Partial<PatientData>) => void;
  addTabToPatient: (patientId: string, tab: any) => void;
  renameTab: (patientId: string, tabId: string, newName: string) => void;
  toggleTabStar: (patientId: string, tabId: string) => void;
  deleteTab: (patientId: string, tabId: string) => void;
  duplicateTab: (patientId: string, tabId: string) => void;
  updateTabProperties: (patientId: string, tabId: string, properties: any) => void;
  reorderTabs: (patientId: string, draggedTabId: string, targetTabId: string, position: 'before' | 'after' | 'child') => void;
}

const PatientContext = createContext<PatientContextType | undefined>(undefined);

export function PatientProvider({ children }: { children: ReactNode }) {
  const [patients, setPatients] = useState<PatientData[]>(mockPatients);
  const [activePatientId, setActivePatientId] = useState<string | null>(
    mockPatients[0]?.id || null
  );

  const activePatient = patients.find(p => p.id === activePatientId) || null;

  const addPatient = (patient: PatientData) => {
    setPatients(prev => [...prev, patient]);
    setActivePatientId(patient.id);
  };

  const removePatient = (id: string) => {
    setPatients(prev => {
      const updated = prev.filter(p => p.id !== id);
      // If removing the active patient, switch to the first remaining patient
      if (activePatientId === id) {
        setActivePatientId(updated[0]?.id || null);
      }
      return updated;
    });
  };

  const updatePatient = (id: string, updates: Partial<PatientData>) => {
    setPatients(prev =>
      prev.map(p => {
        if (p.id === id) {
          // If updating tabs, merge them, otherwise replace
          if (updates.tabs) {
            return { ...p, ...updates };
          }
          return { ...p, ...updates };
        }
        return p;
      })
    );
  };

  const addTabToPatient = (patientId: string, tab: any) => {
    setPatients(prev =>
      prev.map(p => {
        if (p.id === patientId) {
          return {
            ...p,
            tabs: [...p.tabs, tab]
          };
        }
        return p;
      })
    );
  };

  const renameTab = (patientId: string, tabId: string, newName: string) => {
    setPatients(prev =>
      prev.map(p => {
        if (p.id === patientId) {
          return {
            ...p,
            tabs: p.tabs.map(tab =>
              tab.id === tabId ? { ...tab, name: newName } : tab
            )
          };
        }
        return p;
      })
    );
  };

  const toggleTabStar = (patientId: string, tabId: string) => {
    setPatients(prev =>
      prev.map(p => {
        if (p.id === patientId) {
          return {
            ...p,
            tabs: p.tabs.map(tab =>
              tab.id === tabId ? { ...tab, starred: !tab.starred } : tab
            )
          };
        }
        return p;
      })
    );
  };

  const deleteTab = (patientId: string, tabId: string) => {
    setPatients(prev =>
      prev.map(p => {
        if (p.id === patientId) {
          return {
            ...p,
            tabs: p.tabs.filter(tab => tab.id !== tabId)
          };
        }
        return p;
      })
    );
  };

  const duplicateTab = (patientId: string, tabId: string) => {
    setPatients(prev =>
      prev.map(p => {
        if (p.id === patientId) {
          const tabToDuplicate = p.tabs.find(tab => tab.id === tabId);
          if (tabToDuplicate) {
            const newTab = {
              ...tabToDuplicate,
              id: `tab-${Date.now()}`,
              name: `${tabToDuplicate.name} (Copy)`
            };
            return {
              ...p,
              tabs: [...p.tabs, newTab]
            };
          }
        }
        return p;
      })
    );
  };

  const updateTabProperties = (patientId: string, tabId: string, properties: any) => {
    setPatients(prev =>
      prev.map(p => {
        if (p.id === patientId) {
          return {
            ...p,
            tabs: p.tabs.map(tab =>
              tab.id === tabId ? { ...tab, ...properties } : tab
            )
          };
        }
        return p;
      })
    );
  };

  const reorderTabs = (patientId: string, draggedTabId: string, targetTabId: string, position: 'before' | 'after' | 'child') => {
    setPatients(prev =>
      prev.map(p => {
        if (p.id !== patientId) return p;

        const draggedTab = p.tabs.find(t => t.id === draggedTabId);
        const targetTab = p.tabs.find(t => t.id === targetTabId);

        if (!draggedTab || !targetTab) return p;

        let updatedTabs = [...p.tabs];

        if (position === 'child') {
          // Make dragged tab a child of target
          updatedTabs = updatedTabs.map(tab => {
            if (tab.id === draggedTabId) {
              return {
                ...tab,
                parentId: targetTabId,
                isSubtab: true,
                section: targetTab.section // Inherit parent's section
              };
            }
            return tab;
          });
        } else {
          // Reorder tabs (before or after)
          const draggedIndex = updatedTabs.findIndex(t => t.id === draggedTabId);
          const targetIndex = updatedTabs.findIndex(t => t.id === targetTabId);

          // Remove dragged tab
          const [removed] = updatedTabs.splice(draggedIndex, 1);

          // Calculate new index
          let newIndex = updatedTabs.findIndex(t => t.id === targetTabId);
          if (position === 'after') {
            newIndex++;
          }

          // Insert at new position
          updatedTabs.splice(newIndex, 0, {
            ...removed,
            parentId: targetTab.parentId, // Inherit target's parent
            isSubtab: !!targetTab.parentId,
            section: targetTab.section // Stay in same section
          });
        }

        return {
          ...p,
          tabs: updatedTabs
        };
      })
    );
  };

  return (
    <PatientContext.Provider
      value={{
        patients,
        activePatientId,
        activePatient,
        setActivePatientId,
        addPatient,
        removePatient,
        updatePatient,
        addTabToPatient,
        renameTab,
        toggleTabStar,
        deleteTab,
        duplicateTab,
        updateTabProperties,
        reorderTabs
      }}
    >
      {children}
    </PatientContext.Provider>
  );
}

export function usePatient() {
  const context = useContext(PatientContext);
  if (!context) {
    throw new Error('usePatient must be used within PatientProvider');
  }
  return context;
}
