'use client';

import React, { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';

const RESOURCE_TYPES = [
  { key: 'conditions', label: 'Conditions' },
  { key: 'medications', label: 'Medications' },
  { key: 'allergies', label: 'Allergies' },
  { key: 'careTeam', label: 'Care Team' },
  { key: 'familyHistory', label: 'Family History' },
  { key: 'socialHistory', label: 'Social History' },
  { key: 'vitals', label: 'Vitals' },
  { key: 'labs', label: 'Labs' },
];

interface DuplicateResult {
  newPatientFhirId?: string;
  clonedCounts: Record<string, number>;
  errors: string[];
}

interface DuplicatePatientDialogProps {
  onClose: () => void;
  patientFhirId: string;
  patientName: string;
}

export function DuplicatePatientDialog({
  onClose,
  patientFhirId,
  patientName,
}: DuplicatePatientDialogProps) {
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(
    new Set(RESOURCE_TYPES.map((t) => t.key))
  );
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<DuplicateResult | null>(null);

  const toggleType = (key: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleDuplicate = async () => {
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch('/api/case-library/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourcePatientFhirId: patientFhirId,
          resourceTypes: Array.from(selectedTypes),
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ clonedCounts: {}, errors: ['Network error'] });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog onClose={onClose} title="Duplicate Patient">
      <div className="space-y-4">
        <div className="text-sm text-gray-600">
          Duplicating <span className="font-medium">{patientName}</span>
        </div>

        {/* Result display */}
        {result && (
          <div className="space-y-2">
            {result.newPatientFhirId && (
              <div className="text-sm bg-green-50 text-green-700 px-3 py-2 rounded">
                New patient created: {result.newPatientFhirId}
              </div>
            )}
            {Object.entries(result.clonedCounts).map(([type, count]) => (
              <div key={type} className="text-sm text-gray-600 px-2">
                {RESOURCE_TYPES.find((t) => t.key === type)?.label || type}:{' '}
                {count} cloned
              </div>
            ))}
            {result.errors.map((err, i) => (
              <div key={i} className="text-sm bg-red-50 text-red-700 px-3 py-2 rounded">
                {err}
              </div>
            ))}
            <button
              onClick={onClose}
              className="mt-2 w-full px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded"
            >
              Done
            </button>
          </div>
        )}

        {/* Selection form */}
        {!result && (
          <>
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1.5">
                Patient demographics will always be included
              </div>
              <div className="text-xs font-medium text-gray-500 mb-1.5">
                Select resource types to clone
              </div>
              <div className="border rounded divide-y">
                {RESOURCE_TYPES.map((rt) => (
                  <label
                    key={rt.key}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTypes.has(rt.key)}
                      onChange={() => toggleType(rt.key)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{rt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={handleDuplicate}
              disabled={submitting}
              className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded"
            >
              {submitting ? 'Duplicating...' : 'Duplicate Patient'}
            </button>
          </>
        )}
      </div>
    </Dialog>
  );
}
