'use client';

import React from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { PreviewStatus } from './MedicationPreview';

interface ReferralPreviewProps {
  referralType: string;
  referredTo: string;
  reason: string;
  priority: string;
  status: PreviewStatus;
  error?: string;
  onConfirm: () => void;
  onReject: () => void;
}

export function ReferralPreview({
  referralType,
  referredTo,
  reason,
  priority,
  status,
  error,
  onConfirm,
  onReject,
}: ReferralPreviewProps) {
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
          <p className="text-sm text-red-700">{error || 'Failed to parse referral'}</p>
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
    <div className="mx-4 mb-3 p-4 bg-purple-50 border border-purple-200 rounded-lg">
      {status === 'confirming' && (
        <div className="flex items-center gap-2 text-sm text-blue-700 mb-3">
          <Loader2 size={16} className="animate-spin" />
          Saving...
        </div>
      )}

      <div className="mb-2">
        <p className="font-medium text-sm text-gray-900">{referralType || 'Unknown referral'}</p>
        {referredTo && (
          <p className="text-xs text-gray-600 mt-1">Referred to: {referredTo}</p>
        )}
        {reason && (
          <p className="text-xs text-gray-500 mt-0.5">Reason: {reason}</p>
        )}
        {priority && priority !== 'routine' && (
          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs ${
            priority === 'stat'
              ? 'bg-red-100 text-red-700'
              : priority === 'urgent' || priority === 'asap'
              ? 'bg-orange-100 text-orange-700'
              : 'bg-gray-100 text-gray-500'
          }`}>
            {priority}
          </span>
        )}
      </div>

      {status === 'preview' && (
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={onConfirm}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded text-xs font-medium hover:bg-purple-700 transition-colors"
          >
            <Check size={14} />
            Confirm & Refer
          </button>
          <button
            onClick={onReject}
            className="p-1.5 hover:bg-purple-100 rounded transition-colors"
          >
            <X size={16} className="text-gray-500" />
          </button>
        </div>
      )}
    </div>
  );
}
