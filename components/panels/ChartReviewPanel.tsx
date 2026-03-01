'use client';

import React, { useState, useEffect } from 'react';
import { useSidebar } from '@/lib/context/SidebarContext';
import { ChartReviewData } from '@/lib/types/chart-review';
import { requestChartReview } from '@/lib/services/chart-review-service';

type ReviewStatus = 'idle' | 'reviewing' | 'complete' | 'error';

const FEEDBACK_LABELS: Record<string, string> = {
  diagnosis: 'Diagnosis',
  workup: 'Workup',
  treatment: 'Treatment',
  follow_up: 'Follow-up',
  differential_diagnosis: 'Differential Diagnosis',
};

export function ChartReviewPanel() {
  const { chartReviewContent } = useSidebar();
  const [status, setStatus] = useState<ReviewStatus>('idle');
  const [result, setResult] = useState<ChartReviewData | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!chartReviewContent) {
      setStatus('idle');
      setResult(null);
      setErrorMessage('');
      return;
    }

    let cancelled = false;

    async function fetchReview() {
      setStatus('reviewing');
      setResult(null);
      setErrorMessage('');

      const response = await requestChartReview(chartReviewContent!);

      if (cancelled) return;

      if (response.success && response.data) {
        setResult(response.data);
        setStatus('complete');
      } else {
        setErrorMessage(response.error || 'Chart review failed');
        setStatus('error');
      }
    }

    fetchReview();

    return () => {
      cancelled = true;
    };
  }, [chartReviewContent]);

  if (status === 'idle') {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm p-6 text-center">
        Click &quot;Chart Review&quot; on an encounter to generate a review.
      </div>
    );
  }

  if (status === 'reviewing') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500 p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
        <span className="text-sm">Reviewing encounter notes...</span>
      </div>
    );
  }

  if (status === 'error' || !result) {
    return (
      <div className="flex items-center justify-center h-full text-red-500 text-sm p-6 text-center">
        {errorMessage || 'Failed to generate chart review. Please try again.'}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Patient & Provider header */}
      <div className="text-xs text-gray-500 space-y-0.5">
        <div>{result.patient}</div>
        <div>{result.provider}</div>
      </div>

      {/* Key Takeaways */}
      {result.key_takeaways.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <h3 className="text-sm font-semibold text-emerald-800 mb-2">Key Takeaways</h3>
          <ul className="space-y-1.5">
            {result.key_takeaways.map((item, idx) => (
              <li key={idx} className="flex gap-2 text-sm text-emerald-700">
                <span className="text-emerald-500 mt-0.5 shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Feedback sections */}
      {Object.entries(result.feedback).map(([key, items]) => {
        if (!items || items.length === 0) return null;
        const label = FEEDBACK_LABELS[key] || key;
        return (
          <div key={key} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700">{label}</h3>
            </div>
            <ul className="p-4 space-y-2">
              {items.map((item: string, itemIdx: number) => (
                <li key={itemIdx} className="flex gap-2 text-sm text-gray-600">
                  <span className="text-emerald-500 mt-0.5 shrink-0">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
