'use client';

import React, { useState, useEffect } from 'react';
import { usePatient } from '@/lib/context/PatientContext';

export function PatientSummaryHeader() {
  const { activePatient, updatePatient } = usePatient();
  const [summary, setSummary] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (activePatient) {
      setSummary(activePatient.summary || '');
    }
  }, [activePatient]);

  const handleBlur = () => {
    setIsEditing(false);
    if (activePatient && summary !== activePatient.summary) {
      updatePatient(activePatient.id, { summary });
    }
  };

  if (!activePatient) return null;

  const placeholder = summary || 'Add patient one-liner...';

  return (
    <div className="border-b bg-white px-8 py-4">
      {isEditing ? (
        <input
          type="text"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          onBlur={handleBlur}
          autoFocus
          className="w-full text-center text-sm text-gray-900 focus:outline-none"
          placeholder="Add patient one-liner..."
        />
      ) : (
        <div
          onClick={() => setIsEditing(true)}
          className="text-center text-sm text-gray-400 cursor-text hover:text-gray-600"
        >
          {placeholder}
        </div>
      )}
    </div>
  );
}
