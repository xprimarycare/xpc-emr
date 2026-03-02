'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { usePatient } from '@/lib/context/PatientContext';
import { AppImagingOrder } from '@/lib/types/imaging';
import {
  searchFhirImagingOrders,
  upsertFhirImagingOrder,
} from '@/lib/services/fhir-imaging-service';

type SaveStatus = 'idle' | 'loading' | 'saving' | 'success' | 'error';

interface ImagingTabProps {
  imagingView?: 'pending' | 'results';
  onCountsChange?: (pending: number, results: number) => void;
  refreshKey?: number;
}

export function ImagingTab({ imagingView = 'pending', onCountsChange, refreshKey }: ImagingTabProps) {
  const { activePatient } = usePatient();
  const isFhirPatient = !!activePatient?.fhirId;

  const [imagingOrders, setImagingOrders] = useState<AppImagingOrder[]>([]);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AppImagingOrder>>({});

  // Fetch imaging orders when FHIR patient changes
  useEffect(() => {
    if (!isFhirPatient || !activePatient?.fhirId) {
      setImagingOrders([]);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setError(null);
    searchFhirImagingOrders(activePatient.fhirId).then((result) => {
      if (cancelled) return;
      if (result.error) {
        setError(result.error);
        setStatus('error');
      } else {
        setImagingOrders(result.imagingOrders);
        setError(null);
        setStatus('idle');
      }
    });
    return () => { cancelled = true; };
  }, [activePatient?.fhirId, isFhirPatient, refreshKey]);

  // Filter by view and report counts
  const pendingOrders = useMemo(() => imagingOrders.filter(o => o.status === 'draft' || o.status === 'active'), [imagingOrders]);
  const resultOrders = useMemo(() => imagingOrders.filter(o => o.status === 'completed'), [imagingOrders]);
  const filteredOrders = imagingView === 'pending' ? pendingOrders : resultOrders;

  useEffect(() => {
    onCountsChange?.(pendingOrders.length, resultOrders.length);
  }, [pendingOrders.length, resultOrders.length, onCountsChange]);

  const handleEdit = (img: AppImagingOrder) => {
    setEditingId(img.id);
    setEditForm({ ...img });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async (img: AppImagingOrder) => {
    const updated = { ...img, ...editForm } as AppImagingOrder;
    const previousOrders = imagingOrders;

    // Update local state immediately
    setImagingOrders((prev) =>
      prev.map((o) => (o.id === img.id ? updated : o))
    );
    setEditingId(null);
    setEditForm({});

    // Write to Medplum
    setStatus('saving');
    setError(null);
    const result = await upsertFhirImagingOrder(updated);
    if (result.success) {
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } else {
      setImagingOrders(previousOrders);
      setError(result.error || 'Failed to save');
      setStatus('error');
    }
  };

  if (!activePatient) return null;

  return (
    <div className="py-8 px-8">
      <div className="bg-white rounded-lg shadow-sm border p-8 w-full max-w-xl mx-auto">
          <h2 className="text-xl font-semibold mb-6">{imagingView === 'pending' ? 'Pending Imaging' : 'Imaging Results'}</h2>

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
              Loading imaging orders...
            </div>
          )}

          {/* Empty state */}
          {status !== 'loading' && filteredOrders.length === 0 && status !== 'error' && (
            <div className="text-gray-400 text-sm text-center py-8">
              {imagingView === 'pending' ? 'No pending imaging orders' : 'No imaging results'}
            </div>
          )}

          {/* Imaging orders list */}
          {filteredOrders.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 mb-2">
                {filteredOrders.length} {imagingView === 'pending' ? 'pending order' : 'result'}{filteredOrders.length !== 1 ? 's' : ''} from Medplum
              </p>
              {filteredOrders.map((img) => (
                <div
                  key={img.id}
                  className="p-4 border border-gray-200 rounded-lg"
                >
                  {editingId === img.id ? (
                    /* Edit mode */
                    <div className="space-y-3">
                      <p className="font-medium text-sm text-gray-900">{img.studyName}</p>
                      {img.loincCode && (
                        <p className="text-xs text-gray-500">LOINC: {img.loincCode} — {img.loincDisplay}</p>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          value={editForm.status || img.status}
                          onChange={(e) => setEditForm({ ...editForm, status: e.target.value as AppImagingOrder['status'] })}
                        >
                          <option value="draft">Draft</option>
                          <option value="active">Active</option>
                          <option value="completed">Completed</option>
                          <option value="revoked">Revoked</option>
                        </select>
                        <select
                          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          value={editForm.priority || img.priority}
                          onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as AppImagingOrder['priority'] })}
                        >
                          <option value="routine">Routine</option>
                          <option value="urgent">Urgent</option>
                          <option value="asap">ASAP</option>
                          <option value="stat">STAT</option>
                        </select>
                      </div>
                      <input
                        className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={editForm.note ?? img.note ?? ''}
                        onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                        placeholder="Note / clinical indication"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSave(img)}
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
                      onClick={() => handleEdit(img)}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm text-gray-900">{img.studyName}</p>
                        </div>
                        {img.loincCode && (
                          <p className="text-xs text-gray-500 mt-1">
                            LOINC: {img.loincCode}{img.loincDisplay ? ` — ${img.loincDisplay}` : ''}
                          </p>
                        )}
                        {img.authoredOn && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Ordered: {new Date(img.authoredOn).toLocaleDateString()}
                          </p>
                        )}
                        {img.note && (
                          <p className="text-xs text-gray-400 mt-0.5">Note: {img.note}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          img.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : img.status === 'draft'
                            ? 'bg-yellow-100 text-yellow-700'
                            : img.status === 'completed'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {img.status}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          img.priority === 'stat'
                            ? 'bg-red-100 text-red-700'
                            : img.priority === 'urgent' || img.priority === 'asap'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {img.priority}
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
