'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AssignmentRow {
  id: number;
  patientFhirId: string;
  patient: string;
  condition: string;
  clinician: string;
  status: string;
  date: string;
  by: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_DISPLAY: Record<string, string> = {
  waiting_room: 'Waiting Room',
  in_progress: 'In Progress',
  completed: 'Completed',
};

const STATUS_BADGE: Record<string, string> = {
  'Waiting Room': 'bg-yellow-100 text-yellow-800',
  'In Progress': 'bg-blue-100 text-blue-800',
  'Completed': 'bg-green-100 text-green-800',
};

const COL_LABELS: Record<string, string> = {
  patient: 'Patient',
  condition: 'Condition',
  clinician: 'Clinician',
  status: 'Status',
  date: 'Assigned',
  by: 'Assigned By',
};

const COLS = ['patient', 'condition', 'clinician', 'status', 'date', 'by'] as const;
type ColKey = (typeof COLS)[number];

// ---------------------------------------------------------------------------
// ColumnFilter component
// ---------------------------------------------------------------------------

function ColumnFilter({
  col,
  label,
  values,
  activeFilter,
  onApply,
  onClear,
  alignRight,
}: {
  col: string;
  label: string;
  values: string[];
  activeFilter: Set<string> | null;
  onApply: (selected: Set<string>) => void;
  onClear: () => void;
  alignRight?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [tempSelected, setTempSelected] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const allCheckRef = useRef<HTMLInputElement>(null);
  const isActive = activeFilter !== null;

  const allChecked = tempSelected.size === values.length;
  const someChecked = tempSelected.size > 0 && tempSelected.size < values.length;

  useEffect(() => {
    if (allCheckRef.current) {
      allCheckRef.current.indeterminate = someChecked;
    }
  }, [someChecked]);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (open) {
      setOpen(false);
      return;
    }
    setTempSelected(activeFilter ? new Set(activeFilter) : new Set(values));
    setSearch('');
    setOpen(true);
  };

  // Close on outside mousedown (mousedown fires before blur/click so checkboxes still register)
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filteredVals = search
    ? values.filter((v) => v.toLowerCase().includes(search.toLowerCase()))
    : values;

  const toggleVal = (val: string) => {
    setTempSelected((prev) => {
      const next = new Set(prev);
      if (next.has(val)) next.delete(val);
      else next.add(val);
      return next;
    });
  };

  const toggleAll = () => {
    if (allChecked) {
      setTempSelected(new Set());
    } else {
      setTempSelected(new Set(values));
    }
  };

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      <button
        onClick={handleOpen}
        className={`ml-1 transition-opacity ${
          isActive
            ? 'opacity-100 text-indigo-600'
            : 'opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600'
        }`}
        title={`Filter ${label}`}
      >
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 4h18M7 8h10M11 12h2"
          />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute ${
            alignRight ? 'right-0' : 'left-0'
          } top-full mt-1 z-50 w-56 bg-white border border-gray-200 rounded-lg shadow-lg p-2`}
          // Prevent mousedown from bubbling to document (which would close the dropdown)
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Search */}
          <div className="relative mb-2">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none select-none">
              🔍
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full pl-6 pr-3 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-gray-400"
              autoFocus
            />
          </div>

          {/* Select all */}
          <label className="flex items-center gap-2 px-1 py-1 rounded hover:bg-gray-50 cursor-pointer text-xs font-medium text-gray-700">
            <input
              ref={allCheckRef}
              type="checkbox"
              checked={allChecked}
              onChange={toggleAll}
              className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600"
            />
            <span>Select all</span>
          </label>

          <div className="border-t border-gray-100 my-1" />

          {/* Value list */}
          <div className="max-h-40 overflow-y-auto space-y-0.5">
            {filteredVals.map((val) => (
              <label
                key={val}
                className="flex items-center gap-2 px-1 py-1 rounded hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={tempSelected.has(val)}
                  onChange={() => toggleVal(val)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600"
                />
                <span className="text-xs text-gray-700">{val}</span>
              </label>
            ))}
            {filteredVals.length === 0 && (
              <p className="text-xs text-gray-400 px-1 py-1">No matches</p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
            <button
              onClick={() => {
                onClear();
                setOpen(false);
              }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Clear
            </button>
            <button
              onClick={() => {
                if (tempSelected.size === 0 || tempSelected.size === values.length) {
                  onClear();
                } else {
                  onApply(new Set(tempSelected));
                }
                setOpen(false);
              }}
              className="text-xs font-medium text-white bg-gray-900 hover:bg-gray-700 px-3 py-1 rounded"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AssignmentsTable
// ---------------------------------------------------------------------------

export function AssignmentsTable() {
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [columnFilters, setColumnFilters] = useState<
    Partial<Record<ColKey, Set<string> | null>>
  >({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/case-library?view=assignments');
      if (!res.ok) throw new Error('Failed to fetch assignments');
      const data: any[] = await res.json();

      // Fetch patient tags for conditions
      const patientIds = [...new Set(data.map((a) => a.patientFhirId))];
      const conditionMap: Record<string, string> = {};
      if (patientIds.length > 0) {
        try {
          const tagRes = await fetch(
            `/api/patient-tags?patientFhirIds=${patientIds.join(',')}`
          );
          if (tagRes.ok) {
            const tagData: Record<string, { conditions?: string[] }> = await tagRes.json();
            for (const [pid, tags] of Object.entries(tagData)) {
              conditionMap[pid] = (tags.conditions ?? []).join(', ') || '—';
            }
          }
        } catch {
          // conditions are supplementary
        }
      }

      const mapped: AssignmentRow[] = data.map((a) => ({
        id: a.id,
        patientFhirId: a.patientFhirId,
        patient: a.patientName,
        condition: conditionMap[a.patientFhirId] ?? '—',
        clinician: a.clinicianName,
        status: STATUS_DISPLAY[a.status] ?? a.status,
        date: new Date(a.assignedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        by: a.assignedByName ?? '—',
      }));

      setRows(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getColValues = (col: ColKey) => {
    const seen = new Set<string>();
    const vals: string[] = [];
    rows.forEach((r) => {
      const v = r[col];
      if (!seen.has(v)) {
        seen.add(v);
        vals.push(v);
      }
    });
    return vals.sort();
  };

  const setFilter = (col: ColKey, selected: Set<string>) => {
    setColumnFilters((prev) => ({ ...prev, [col]: selected }));
  };

  const clearFilter = (col: ColKey) => {
    setColumnFilters((prev) => ({ ...prev, [col]: null }));
  };

  const filteredRows = rows.filter((row) =>
    COLS.every((col) => {
      const f = columnFilters[col];
      if (!f) return true;
      return f.has(row[col]);
    })
  );

  const activeCols = COLS.filter((col) => columnFilters[col]);

  const colDefs: { col: ColKey; label: string; alignRight?: boolean }[] = [
    { col: 'patient', label: 'Patient' },
    { col: 'condition', label: 'Condition' },
    { col: 'clinician', label: 'Clinician' },
    { col: 'status', label: 'Status' },
    { col: 'date', label: 'Assigned', alignRight: true },
    { col: 'by', label: 'Assigned By', alignRight: true },
  ];

  return (
    <div>
      {/* Filter pills + count */}
      <div className="px-6 py-2.5 border-b border-gray-100 flex flex-wrap items-center gap-2 min-h-[40px]">
        <span className="text-xs text-gray-400">
          {loading
            ? 'Loading...'
            : `${filteredRows.length}${
                filteredRows.length !== rows.length ? ` of ${rows.length}` : ''
              } assignment${rows.length !== 1 ? 's' : ''}`}
        </span>
        {activeCols.map((col) => {
          const sel = columnFilters[col]!;
          return (
            <span
              key={col}
              className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-2.5 py-0.5"
            >
              <span>
                {COL_LABELS[col]}: {Array.from(sel).join(', ')}
              </span>
              <button
                onClick={() => clearFilter(col)}
                className="text-indigo-400 hover:text-indigo-700 leading-none"
              >
                ×
              </button>
            </span>
          );
        })}
        <button
          onClick={fetchData}
          className="ml-auto text-gray-400 hover:text-gray-600"
          title="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {loading && (
          <div className="text-center py-12 text-sm text-gray-400">
            Loading assignments...
          </div>
        )}
        {error && (
          <div className="text-center py-12 text-sm text-red-500">{error}</div>
        )}
        {!loading && !error && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {colDefs.map(({ col, label, alignRight }) => (
                  <th
                    key={col}
                    className={`group px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative ${
                      columnFilters[col] ? 'bg-indigo-50/60' : ''
                    }`}
                  >
                    <div className="flex items-center">
                      {label}
                      <ColumnFilter
                        col={col}
                        label={label}
                        values={getColValues(col)}
                        activeFilter={columnFilters[col] ?? null}
                        onApply={(sel) => setFilter(col, sel)}
                        onClear={() => clearFilter(col)}
                        alignRight={alignRight}
                      />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900 whitespace-nowrap">
                    {row.patient}
                  </td>
                  <td className="px-6 py-3 text-gray-500">{row.condition}</td>
                  <td className="px-6 py-3 text-gray-600">{row.clinician}</td>
                  <td className="px-6 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        STATUS_BADGE[row.status] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {row.date}
                  </td>
                  <td className="px-6 py-3 text-gray-400 text-xs">{row.by}</td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-sm text-gray-400"
                  >
                    No assignments match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
