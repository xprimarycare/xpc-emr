'use client';

import React, { useState, useCallback } from 'react';
import { Check, X, Loader2, ChevronDown, ChevronRight, Star } from 'lucide-react';
import {
  ResolvedCode,
  starLabCode,
  unstarLabCode,
  isLabCodeStarred,
} from '@/lib/services/fhir-lab-service';

export type LabPreviewStatus = 'resolving' | 'preview' | 'confirming' | 'error';

// Color scheme presets
const colorSchemes = {
  purple: {
    bg: 'bg-purple-50', border: 'border-purple-200',
    hoverRow: 'hover:bg-purple-100', hoverStar: 'hover:bg-purple-200',
    checkbox: 'text-purple-600 focus:ring-purple-500',
    btn: 'bg-purple-600 hover:bg-purple-700',
    btnHover: 'hover:bg-purple-100',
  },
  teal: {
    bg: 'bg-teal-50', border: 'border-teal-200',
    hoverRow: 'hover:bg-teal-100', hoverStar: 'hover:bg-teal-200',
    checkbox: 'text-teal-600 focus:ring-teal-500',
    btn: 'bg-teal-600 hover:bg-teal-700',
    btnHover: 'hover:bg-teal-100',
  },
};

interface LabPreviewProps {
  codes: ResolvedCode[];
  status: LabPreviewStatus;
  error?: string;
  selectedIndices: Set<number>;
  onToggleIndex: (index: number) => void;
  onConfirm: () => void;
  onReject: () => void;
  /** Display label: "lab" (default) or "imaging" */
  label?: string;
  /** Color scheme: "purple" (default) or "teal" */
  colorScheme?: keyof typeof colorSchemes;
  /** Override: check if a code is starred */
  isCodeStarred?: (code: string) => boolean;
  /** Override: star a code */
  onStarCode?: (code: string) => void;
  /** Override: unstar a code */
  onUnstarCode?: (code: string) => void;
}

function CodeRow({
  code,
  index,
  checked,
  disabled,
  starred,
  showStar,
  onToggle,
  onToggleStar,
  colors,
}: {
  code: ResolvedCode;
  index: number;
  checked: boolean;
  disabled: boolean;
  starred: boolean;
  showStar: boolean;
  onToggle: (i: number) => void;
  onToggleStar?: (code: string) => void;
  colors: typeof colorSchemes.purple;
}) {
  return (
    <div
      className={`flex items-center gap-2 py-1.5 px-1 rounded cursor-pointer ${colors.hoverRow} transition-colors`}
      onClick={() => {
        if (!disabled) onToggle(index);
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        readOnly
        className={`rounded border-gray-300 ${colors.checkbox} pointer-events-none`}
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-gray-900">{code.description}</p>
        <p className="text-xs text-gray-500">LOINC: {code.code}</p>
      </div>
      {showStar && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar?.(code.code);
          }}
          className={`p-1 ${colors.hoverStar} rounded transition-colors flex-shrink-0`}
          title={starred ? 'Remove as preferred' : 'Set as preferred'}
        >
          <Star
            size={14}
            className={starred ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400'}
          />
        </button>
      )}
    </div>
  );
}

export function LabPreview({
  codes,
  status,
  error,
  selectedIndices,
  onToggleIndex,
  onConfirm,
  onReject,
  label = 'lab',
  colorScheme = 'purple',
  isCodeStarred: isCodeStarredProp,
  onStarCode,
  onUnstarCode,
}: LabPreviewProps) {
  const [showOthers, setShowOthers] = useState(false);
  // Force re-render when starring changes
  const [, setStarVersion] = useState(0);

  const colors = colorSchemes[colorScheme];

  // Use provided star functions or fall back to lab defaults
  const checkStarred = isCodeStarredProp || isLabCodeStarred;
  const doStar = onStarCode || starLabCode;
  const doUnstar = onUnstarCode || unstarLabCode;

  const handleToggleStar = useCallback((loincCode: string) => {
    if (checkStarred(loincCode)) {
      doUnstar(loincCode);
    } else {
      doStar(loincCode);
    }
    setStarVersion((v) => v + 1);
  }, [checkStarred, doStar, doUnstar]);

  const orderNoun = label === 'imaging' ? 'imaging study' : 'lab order';
  const orderNounPlural = label === 'imaging' ? 'imaging studies' : 'lab orders';
  const emptyText = label === 'imaging' ? 'No imaging studies identified' : 'No lab tests identified';

  if (status === 'resolving') {
    return (
      <div className="mx-4 mb-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-2 text-sm text-blue-700">
          <Loader2 size={16} className="animate-spin" />
          Resolving {label} codes with PhenoML...
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mx-4 mb-3 p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center justify-between">
          <p className="text-sm text-red-700">{error || `Failed to resolve ${label} codes`}</p>
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

  const selectedCount = codes.filter((_, i) => selectedIndices.has(i)).length;
  const topCode = codes[0];
  const otherCodes = codes.slice(1);
  const isInteractive = status === 'preview';

  return (
    <div className={`mx-4 mb-3 p-4 ${colors.bg} ${colors.border} border rounded-lg`}>
      {status === 'confirming' && (
        <div className="flex items-center gap-2 text-sm text-blue-700 mb-3">
          <Loader2 size={16} className="animate-spin" />
          Writing {selectedCount !== 1 ? orderNounPlural : orderNoun} to EMR...
        </div>
      )}

      <div className="space-y-1 mb-2">
        {/* Top result — always visible */}
        {topCode && (
          <CodeRow
            code={topCode}
            index={0}
            checked={selectedIndices.has(0)}
            disabled={!isInteractive}
            starred={checkStarred(topCode.code)}
            showStar={isInteractive && checkStarred(topCode.code)}
            onToggle={onToggleIndex}
            onToggleStar={handleToggleStar}
            colors={colors}
          />
        )}

        {/* Other options — collapsed by default */}
        {otherCodes.length > 0 && (
          <>
            <button
              onClick={() => setShowOthers(!showOthers)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 py-1 px-1 transition-colors"
            >
              {showOthers ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {otherCodes.length} other option{otherCodes.length !== 1 ? 's' : ''}
            </button>
            {showOthers && (
              <div>
                {otherCodes.map((code, i) => (
                  <CodeRow
                    key={i + 1}
                    code={code}
                    index={i + 1}
                    checked={selectedIndices.has(i + 1)}
                    disabled={!isInteractive}
                    starred={checkStarred(code.code)}
                    showStar={isInteractive}
                    onToggle={onToggleIndex}
                    onToggleStar={handleToggleStar}
                    colors={colors}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {codes.length === 0 && (
          <p className="text-sm text-gray-500">{emptyText}</p>
        )}
      </div>

      {isInteractive && codes.length > 0 && (
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={onConfirm}
            disabled={selectedCount === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 ${colors.btn} text-white rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Check size={14} />
            Confirm & Order{selectedCount > 0 ? ` (${selectedCount})` : ''}
          </button>
          <button
            onClick={onReject}
            className={`p-1.5 ${colors.btnHover} rounded transition-colors`}
          >
            <X size={16} className="text-gray-500" />
          </button>
        </div>
      )}
    </div>
  );
}
