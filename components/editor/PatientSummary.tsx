'use client';

import { useEffect, useRef, useState } from 'react';
import { usePatientSummary, useSaveSummary } from '@/hooks/usePatients';
import { useDebounce } from '@/hooks/useDebounce';

interface PatientSummaryProps {
  patientId: string | null;
}

export function PatientSummary({ patientId }: PatientSummaryProps) {
  const { data: summary = '' } = usePatientSummary(patientId);
  const saveSummary = useSaveSummary();
  const [localSummary, setLocalSummary] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);
  const debouncedSummary = useDebounce(localSummary, 1000);

  // Update local summary when data loads
  useEffect(() => {
    if (summary && contentRef.current && !localSummary) {
      contentRef.current.innerHTML = summary;
      setLocalSummary(summary);
    }
  }, [summary, localSummary]);

  // Save debounced summary
  useEffect(() => {
    if (patientId && debouncedSummary && debouncedSummary !== summary) {
      saveSummary.mutate({ patientId, summary: debouncedSummary });
    }
  }, [debouncedSummary, patientId, summary, saveSummary]);

  const handleInput = () => {
    if (contentRef.current) {
      setLocalSummary(contentRef.current.innerHTML);
    }
  };

  if (!patientId) return null;

  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
      <div className="max-w-4xl mx-auto">
        <div
          ref={contentRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          className="px-8 py-4 text-base text-gray-900 outline-none cursor-text min-h-[60px] hover:bg-gray-50 focus:bg-white transition-colors"
          data-placeholder="Add patient one-liner..."
          style={{
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
          }}
        />
        <style jsx>{`
          [data-placeholder]:empty::before {
            content: attr(data-placeholder);
            color: #9ca3af;
            pointer-events: none;
          }
        `}</style>
      </div>
    </div>
  );
}
