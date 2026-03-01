'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { usePatient } from '@/lib/context/PatientContext';
import { AppLabOrder } from '@/lib/types/lab';
import {
  searchFhirLabOrders,
  upsertFhirLabOrder,
} from '@/lib/services/fhir-lab-service';

type SaveStatus = 'idle' | 'loading' | 'saving' | 'success' | 'error';

interface LabsTabProps {
  labView?: 'pending' | 'results';
  onCountsChange?: (pending: number, results: number) => void;
}

export function LabsTab({ labView = 'pending', onCountsChange }: LabsTabProps) {
  const { activePatient } = usePatient();
  const isFhirPatient = !!activePatient?.fhirId;

  const [labOrders, setLabOrders] = useState<AppLabOrder[]>([]);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AppLabOrder>>({});

  // Fetch lab orders when FHIR patient changes
  useEffect(() => {
    if (!isFhirPatient || !activePatient?.fhirId) {
      setLabOrders([]);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setError(null);
    searchFhirLabOrders(activePatient.fhirId).then((result) => {
      if (cancelled) return;
      if (result.error) {
        setError(result.error);
        setStatus('error');
      } else {
        setLabOrders(result.labOrders);
        setError(null);
        setStatus('idle');
      }
    });
    return () => { cancelled = true; };
  }, [activePatient?.fhirId, isFhirPatient]);

  // Filter by view and report counts
  const pendingOrders = useMemo(() => labOrders.filter(l => l.status === 'draft' || l.status === 'active'), [labOrders]);
  const resultOrders = useMemo(() => labOrders.filter(l => l.status === 'completed'), [labOrders]);
  const filteredOrders = labView === 'pending' ? pendingOrders : resultOrders;

  useEffect(() => {
    onCountsChange?.(pendingOrders.length, resultOrders.length);
  }, [pendingOrders.length, resultOrders.length, onCountsChange]);

  const handleEdit = (lab: AppLabOrder) => {
    setEditingId(lab.id);
    setEditForm({ ...lab });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async (lab: AppLabOrder) => {
    const updated = { ...lab, ...editForm } as AppLabOrder;
    const previousLabOrders = labOrders;

    // Update local state immediately
    setLabOrders((prev) =>
      prev.map((l) => (l.id === lab.id ? updated : l))
    );
    setEditingId(null);
    setEditForm({});

    // Write to Medplum
    setStatus('saving');
    setError(null);
    const result = await upsertFhirLabOrder(updated);
    if (result.success) {
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } else {
      setLabOrders(previousLabOrders);
      setError(result.error || 'Failed to save');
      setStatus('error');
    }
  };

  if (!activePatient) return null;

  return (
    <div className="py-8 px-8">
      <div className="bg-white rounded-lg shadow-sm border p-8 w-full max-w-xl mx-auto">
          <h2 className="text-xl font-semibold mb-6">{labView === 'pending' ? 'Pending Labs' : 'Lab Results'}</h2>

          {/* Status banners */}
          {status === 'error' && error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={() => { setError(null); setStatus('idle'); }}
                className="ml-2 text-red-500 hover:text-red-700 text-xs font-medium"
              >
                Dismiss
              </button>
            </div>
          )}

          {status === 'success' && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
              Saved to Medplum
            </div>
          )}

          {status === 'saving' && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
              Saving to Medplum...
            </div>
          )}

          {/* Loading state */}
          {status === 'loading' && (
            <div className="text-gray-400 text-sm text-center py-8">
              Loading lab orders...
            </div>
          )}

          {/* Empty state */}
          {status !== 'loading' && filteredOrders.length === 0 && status !== 'error' && (
            <div className="text-gray-400 text-sm text-center py-8">
              {labView === 'pending' ? 'No pending lab orders' : 'No lab results'}
            </div>
          )}

          {/* Lab orders list */}
          {filteredOrders.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 mb-2">
                {filteredOrders.length} {labView === 'pending' ? 'pending order' : 'result'}{filteredOrders.length !== 1 ? 's' : ''} from Medplum
              </p>
              {filteredOrders.map((lab) => (
                <div
                  key={lab.id}
                  className="p-4 border border-gray-200 rounded-lg"
                >
                  {editingId === lab.id ? (
                    /* Edit mode */
                    <div className="space-y-3">
                      <p className="font-medium text-sm text-gray-900">{lab.testName}</p>
                      {lab.loincCode && (
                        <p className="text-xs text-gray-500">LOINC: {lab.loincCode} — {lab.loincDisplay}</p>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          value={editForm.status || lab.status}
                          onChange={(e) => setEditForm({ ...editForm, status: e.target.value as AppLabOrder['status'] })}
                        >
                          <option value="draft">Draft</option>
                          <option value="active">Active</option>
                          <option value="completed">Completed</option>
                          <option value="revoked">Revoked</option>
                        </select>
                        <select
                          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          value={editForm.priority || lab.priority}
                          onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as AppLabOrder['priority'] })}
                        >
                          <option value="routine">Routine</option>
                          <option value="urgent">Urgent</option>
                          <option value="asap">ASAP</option>
                          <option value="stat">STAT</option>
                        </select>
                      </div>
                      <input
                        className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={editForm.note ?? lab.note ?? ''}
                        onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                        placeholder="Note"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSave(lab)}
                          disabled={status === 'saving'}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {status === 'saving' ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={handleCancel}
                          className="px-4 py-2 bg-gray-100 text-gray-600 rounded-md text-sm hover:bg-gray-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Display mode */
                    <div
                      className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -m-4 p-4 rounded-lg"
                      onClick={() => handleEdit(lab)}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm text-gray-900">{lab.testName}</p>
                        </div>
                        {lab.loincCode && (
                          <p className="text-xs text-gray-500 mt-1">
                            LOINC: {lab.loincCode}{lab.loincDisplay ? ` — ${lab.loincDisplay}` : ''}
                          </p>
                        )}
                        {lab.authoredOn && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Ordered: {new Date(lab.authoredOn).toLocaleDateString()}
                          </p>
                        )}
                        {lab.note && (
                          <p className="text-xs text-gray-400 mt-0.5">Note: {lab.note}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          lab.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : lab.status === 'draft'
                            ? 'bg-yellow-100 text-yellow-700'
                            : lab.status === 'completed'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {lab.status}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          lab.priority === 'stat'
                            ? 'bg-red-100 text-red-700'
                            : lab.priority === 'urgent' || lab.priority === 'asap'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {lab.priority}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {isFhirPatient && status === 'idle' && (
            <p className="text-xs text-gray-400 text-center mt-4">
              Changes will be saved to Medplum
            </p>
          )}
      </div>
    </div>
  );
}
