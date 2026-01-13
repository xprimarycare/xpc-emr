'use client';

import { usePatients, useDeletePatient } from '@/hooks/usePatients';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PatientTabsProps {
  activePatientId: string | null;
  onPatientChange: (patientId: string) => void;
  onAddPatient: () => void;
}

export function PatientTabs({
  activePatientId,
  onPatientChange,
  onAddPatient,
}: PatientTabsProps) {
  const { data: patients = [] } = usePatients();
  const deletePatient = useDeletePatient();

  const handleClosePatient = (e: React.MouseEvent, patientId: string) => {
    e.stopPropagation();
    
    // Don't close if it's the only patient
    if (patients.length <= 1) return;
    
    // If closing active patient, switch to another one
    if (activePatientId === patientId) {
      const currentIndex = patients.findIndex(p => p.id === patientId);
      const nextPatient = patients[currentIndex + 1] || patients[currentIndex - 1];
      if (nextPatient) {
        onPatientChange(nextPatient.id);
      }
    }
    
    deletePatient.mutate(patientId);
  };

  const calculateAge = (dob: string): number => {
    if (!dob) return 0;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const formatAgeSex = (dob: string, sex: string): string => {
    const age = calculateAge(dob);
    const sexAbbrev = sex ? sex.charAt(0).toUpperCase() : '';
    if (age && sexAbbrev) {
      return `${age} ${sexAbbrev}`;
    } else if (age) {
      return `${age}`;
    } else if (sexAbbrev) {
      return sexAbbrev;
    }
    return 'No info';
  };

  return (
    <div className="flex items-center gap-2 flex-shrink-0 overflow-x-auto scrollbar-hide">
      {patients.map((patient) => (
        <button
          key={patient.id}
          onClick={() => onPatientChange(patient.id)}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap group',
            activePatientId === patient.id
              ? 'bg-blue-50 text-blue-700'
              : 'hover:bg-gray-100 text-gray-700'
          )}
        >
          <Avatar className="h-7 w-7">
            <AvatarFallback
              className={cn(
                'text-xs font-semibold',
                activePatientId === patient.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-600'
              )}
            >
              {patient.avatar}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start gap-0.5 min-w-0">
            <span className="text-sm font-medium leading-none">{patient.name}</span>
            <span className="text-xs text-gray-500 leading-none">
              {formatAgeSex(patient.dob, patient.sex)}
            </span>
          </div>
          {patients.length > 1 && (
            <button
              onClick={(e) => handleClosePatient(e, patient.id)}
              className={cn(
                'ml-1 p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity',
                'hover:bg-red-100 hover:text-red-600'
              )}
              title="Close patient"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </button>
      ))}

      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 rounded-full border-dashed flex-shrink-0"
        onClick={onAddPatient}
        title="Add new patient"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
