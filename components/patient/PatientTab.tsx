'use client';

import React from 'react';
import { X } from 'lucide-react';
import { PatientData } from '@/lib/types/patient';

interface PatientTabProps {
  patient: PatientData;
  isActive: boolean;
  onClick: () => void;
  onClose?: () => void;
}

export function PatientTab({ patient, isActive, onClick, onClose }: PatientTabProps) {
  const initials = patient.name.split(' ').map(n => n[0]).join('').toUpperCase();
  const age = patient.dob ? new Date().getFullYear() - new Date(patient.dob).getFullYear() : '';
  const sexInitial = patient.sex ? patient.sex.charAt(0).toUpperCase() : '';
  const subtitle = age && sexInitial ? `${age} ${sexInitial}` : patient.mrn;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
        isActive
          ? 'bg-blue-100'
          : 'bg-gray-100 hover:bg-gray-200'
      }`}
      onClick={onClick}
    >
      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-xs">
        {initials}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-medium truncate">{patient.name}</span>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </div>
      {onClose && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="ml-1 p-0.5 hover:bg-white/50 rounded"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
