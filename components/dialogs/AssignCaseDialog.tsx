'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from '@/components/ui/dialog';

interface Clinician {
  id: string;
  name: string | null;
  email?: string;
  role?: string;
  institution?: string | null;
}

interface AssignResult {
  clinicianId: string;
  success: boolean;
  encounterFhirId?: string;
  error?: string;
}

interface AssignCaseDialogProps {
  onClose: () => void;
  patientFhirId: string;
  patientName: string;
  encounterFhirId?: string;
}

export function AssignCaseDialog({
  onClose,
  patientFhirId,
  patientName,
  encounterFhirId,
}: AssignCaseDialogProps) {
  const [clinicians, setClinicians] = useState<Clinician[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [includeNoteText, setIncludeNoteText] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<AssignResult[] | null>(null);

  useEffect(() => {
    fetch('/api/user/list')
      .then((res) => res.json())
      .then((data) => setClinicians((data.users ?? []) as Clinician[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleClinician = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAssign = async () => {
    if (selectedIds.size === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/case-library/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientFhirId,
          clinicianIds: Array.from(selectedIds),
          encounterFhirId: encounterFhirId || undefined,
          includeNoteText,
        }),
      });
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([{ clinicianId: '', success: false, error: 'Network error' }]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog onClose={onClose} title="Assign Case">
      <div className="space-y-4">
        <div className="text-sm text-gray-600">
          Assigning <span className="font-medium">{patientName}</span>
        </div>

        {/* Results display */}
        {results && (
          <div className="space-y-1">
            {results.map((r, i) => {
              const clinician = clinicians.find((c) => c.id === r.clinicianId);
              return (
                <div
                  key={i}
                  className={`text-sm px-2 py-1 rounded ${
                    r.success
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-red-700'
                  }`}
                >
                  {clinician?.name || r.clinicianId}:{' '}
                  {r.success ? 'Assigned' : r.error}
                </div>
              );
            })}
            <button
              onClick={onClose}
              className="mt-3 w-full px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded"
            >
              Done
            </button>
          </div>
        )}

        {/* Assignment form */}
        {!results && (
          <>
            {/* Clinician list */}
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1.5">
                Select clinicians
              </div>
              {loading ? (
                <div className="text-sm text-gray-400">Loading...</div>
              ) : (
                <div className="max-h-48 overflow-y-auto border rounded divide-y">
                  {clinicians.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleClinician(c.id)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">{c.name || c.email || c.id}</span>
                      {(c.institution || c.email) && (
                        <span className="text-xs text-gray-400 ml-1">
                          {[c.institution, c.email].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </label>
                  ))}
                  {clinicians.length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-400">
                      No clinicians found
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Note text option */}
            {encounterFhirId && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1.5">
                  Encounter clone options
                </div>
                <div className="space-y-1">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="noteText"
                      checked={includeNoteText}
                      onChange={() => setIncludeNoteText(true)}
                    />
                    Include note text
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="noteText"
                      checked={!includeNoteText}
                      onChange={() => setIncludeNoteText(false)}
                    />
                    Blank encounter
                  </label>
                </div>
              </div>
            )}

            <button
              onClick={handleAssign}
              disabled={selectedIds.size === 0 || submitting}
              className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded"
            >
              {submitting
                ? 'Assigning...'
                : `Assign to ${selectedIds.size} clinician${selectedIds.size !== 1 ? 's' : ''}`}
            </button>
          </>
        )}
      </div>
    </Dialog>
  );
}
