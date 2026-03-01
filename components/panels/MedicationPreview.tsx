'use client';

import React from 'react';
import { Check, X, Loader2 } from 'lucide-react';

export type PreviewStatus = 'parsing' | 'preview' | 'confirming' | 'error';

interface MedicationPreviewProps {
  name: string;
  dose: string;
  route: string;
  frequency: string;
  dosageText: string;
  status: PreviewStatus;
  error?: string;
  onConfirm: () => void;
  onReject: () => void;
}

export function MedicationPreview({
  name,
  dose,
  route,
  frequency,
  dosageText,
  status,
  error,
  onConfirm,
  onReject,
}: MedicationPreviewProps) {
  if (status === 'parsing') {
    return (
      <div className="mx-4 mb-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-2 text-sm text-blue-700">
          <Loader2 size={16} className="animate-spin" />
          Parsing with PhenoML...
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mx-4 mb-3 p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center justify-between">
          <p className="text-sm text-red-700">{error || 'Failed to parse medication'}</p>
          <button
            onClick={onReject}
            className="p-1 hover:bg-red-100 rounded transition-colors"
          >
            <X size={14} className="text-red-500" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-4 mb-3 p-4 bg-green-50 border border-green-200 rounded-lg">
      {status === 'confirming' && (
        <div className="flex items-center gap-2 text-sm text-blue-700 mb-3">
          <Loader2 size={16} className="animate-spin" />
          Writing to Medplum...
        </div>
      )}

      <div className="mb-2">
        <p className="font-medium text-sm text-gray-900">{name || 'Unknown medication'}</p>
        <p className="text-xs text-gray-600 mt-1">
          {[dose, route, frequency].filter(Boolean).join(' · ') || 'No details parsed'}
        </p>
        {dosageText && (
          <p className="text-xs text-gray-400 mt-0.5">{dosageText}</p>
        )}
      </div>

      {status === 'preview' && (
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={onConfirm}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition-colors"
          >
            <Check size={14} />
            Confirm & Prescribe
          </button>
          <button
            onClick={onReject}
            className="p-1.5 hover:bg-green-100 rounded transition-colors"
          >
            <X size={16} className="text-gray-500" />
          </button>
        </div>
      )}
    </div>
  );
}
