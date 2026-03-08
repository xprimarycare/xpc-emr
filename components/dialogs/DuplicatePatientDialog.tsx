'use client';

import React, { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { CLONEABLE_RESOURCE_TYPES } from '@/lib/data/cloneable-resource-types';

interface DuplicateResult {
  newPatientFhirId?: string;
  clonedCounts: Record<string, number>;
  errors: string[];
}

interface DuplicatePatientDialogProps {
  onClose: () => void;
  patientFhirId: string;
  patientName: string;
  patientAge?: string;
  patientGender?: string;
}

type Step = 'select' | 'preview' | 'done';

export function DuplicatePatientDialog({
  onClose,
  patientFhirId,
  patientName,
  patientAge,
  patientGender,
}: DuplicatePatientDialogProps) {
  const [step, setStep] = useState<Step>('select');
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(
    new Set(CLONEABLE_RESOURCE_TYPES.map((t) => t.key))
  );

  // Preview step state
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewFirstName, setPreviewFirstName] = useState('');
  const [previewLastName, setPreviewLastName] = useState('');
  const [previewBirthDate, setPreviewBirthDate] = useState('');
  const [previewGender, setPreviewGender] = useState(patientGender?.toLowerCase() ?? '');

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

  const handleNext = async () => {
    setLoadingPreview(true);
    setPreviewError(null);
    try {
      const res = await fetch(
        `/api/case-library/duplicate/preview?sourcePatientFhirId=${encodeURIComponent(patientFhirId)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Preview failed');
      setPreviewFirstName(data.given?.[0] ?? '');
      setPreviewLastName(data.family ?? '');
      setPreviewBirthDate(data.birthDate ?? '');
      setPreviewGender(patientGender?.toLowerCase() ?? '');
      setStep('preview');
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to generate preview. Please try again.');
    } finally {
      setLoadingPreview(false);
    }
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
          overrideName: { given: [previewFirstName.trim()], family: previewLastName.trim() },
          overrideBirthDate: previewBirthDate || undefined,
          overrideGender: previewGender || undefined,
        }),
      });
      const data = await res.json();
      setResult(data);
      setStep('done');
    } catch {
      setResult({ clonedCounts: {}, errors: ['Network error'] });
      setStep('done');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog onClose={onClose} title="Duplicate Patient">
      <div className="space-y-4">
        <div className="text-sm text-gray-600">
          Duplicating <span className="font-medium">{patientName}</span>
          {(patientAge || patientGender) && (
            <span className="text-gray-400 font-normal">
              {' '}({[patientAge ? `${patientAge}` : '', patientGender ? patientGender.charAt(0).toUpperCase() : ''].filter(Boolean).join(' ')})
            </span>
          )}
        </div>

        {/* Step 1: Resource selection */}
        {step === 'select' && (
          <>
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1.5">
                Patient demographics will always be included
              </div>
              <div className="text-xs font-medium text-gray-500 mb-1.5">
                Select resource types to clone
              </div>
              <div className="border rounded divide-y">
                {CLONEABLE_RESOURCE_TYPES.map((rt) => (
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

            {previewError && (
              <div className="text-sm bg-red-50 text-red-700 px-3 py-2 rounded">
                {previewError}
              </div>
            )}

            <button
              onClick={handleNext}
              disabled={loadingPreview}
              className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded"
            >
              {loadingPreview ? 'Generating...' : 'Next: Review Name & DOB'}
            </button>
          </>
        )}

        {/* Step 2: Name + DOB preview / edit */}
        {step === 'preview' && (
          <>
            <div className="text-sm text-gray-500 -mt-1">
              Review and edit the generated name and date of birth for the duplicate patient.
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    First name
                  </label>
                  <input
                    type="text"
                    value={previewFirstName}
                    onChange={(e) => setPreviewFirstName(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Last name
                  </label>
                  <input
                    type="text"
                    value={previewLastName}
                    onChange={(e) => setPreviewLastName(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Date of birth
                  {previewBirthDate && (() => {
                    const ms = new Date(previewBirthDate).getTime();
                    if (!isNaN(ms)) {
                      const age = Math.floor((Date.now() - ms) / (365.25 * 24 * 60 * 60 * 1000));
                      return <span className="ml-1.5 font-normal text-gray-400">({age} yo)</span>;
                    }
                  })()}
                </label>
                  <input
                    type="date"
                    value={previewBirthDate}
                    onChange={(e) => setPreviewBirthDate(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Sex
                  </label>
                  <select
                    value={previewGender}
                    onChange={(e) => setPreviewGender(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Unknown</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStep('select')}
                className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 rounded"
              >
                Back
              </button>
              <button
                onClick={handleDuplicate}
                disabled={submitting || !previewFirstName.trim() || !previewLastName.trim()}
                className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded"
              >
                {submitting ? 'Duplicating...' : 'Duplicate Patient'}
              </button>
            </div>
          </>
        )}

        {/* Step 3: Result */}
        {step === 'done' && result && (
          <div className="space-y-2">
            {result.newPatientFhirId && (
              <div className="text-sm bg-green-50 text-green-700 px-3 py-2 rounded">
                New patient created: {result.newPatientFhirId}
              </div>
            )}
            {Object.entries(result.clonedCounts).map(([type, count]) => (
              <div key={type} className="text-sm text-gray-600 px-2">
                {CLONEABLE_RESOURCE_TYPES.find((t) => t.key === type)?.label || type}:{' '}
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
      </div>
    </Dialog>
  );
}
