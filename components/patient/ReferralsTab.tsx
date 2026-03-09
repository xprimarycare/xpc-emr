'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { usePatient } from '@/lib/context/PatientContext';
import { AppReferral } from '@/lib/types/referral';
import {
  searchFhirReferrals,
  upsertFhirReferral,
} from '@/lib/services/fhir-referral-service';

type SaveStatus = 'idle' | 'loading' | 'saving' | 'success' | 'error';

interface ReferralsTabProps {
  referralView?: 'pending' | 'completed';
  onCountsChange?: (pending: number, completed: number) => void;
  refreshKey?: number;
}

export function ReferralsTab({ referralView = 'pending', onCountsChange, refreshKey }: ReferralsTabProps) {
  const { activePatient } = usePatient();
  const isFhirPatient = !!activePatient?.fhirId;

  const [referrals, setReferrals] = useState<AppReferral[]>([]);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<AppReferral>>({});

  // Fetch referrals when FHIR patient changes
  useEffect(() => {
    if (!isFhirPatient || !activePatient?.fhirId) {
      setReferrals([]);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setError(null);
    searchFhirReferrals(activePatient.fhirId).then((result) => {
      if (cancelled) return;
      if (result.error) {
        setError(result.error);
        setStatus('error');
      } else {
        setReferrals(result.referrals);
        setError(null);
        setStatus('idle');
      }
    });
    return () => { cancelled = true; };
  }, [activePatient?.fhirId, isFhirPatient, refreshKey]);

  // Filter by view and report counts
  const pendingReferrals = useMemo(() => referrals.filter(r => r.status === 'draft' || r.status === 'active'), [referrals]);
  const completedReferrals = useMemo(() => referrals.filter(r => r.status === 'completed'), [referrals]);
  const filteredReferrals = referralView === 'pending' ? pendingReferrals : completedReferrals;

  useEffect(() => {
    onCountsChange?.(pendingReferrals.length, completedReferrals.length);
  }, [pendingReferrals.length, completedReferrals.length, onCountsChange]);

  const handleEdit = (referral: AppReferral) => {
    setEditingId(referral.id);
    setEditForm({ ...referral });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async (referral: AppReferral) => {
    const updated = { ...referral, ...editForm } as AppReferral;
    const previousReferrals = referrals;

    // Update local state immediately
    setReferrals((prev) =>
      prev.map((r) => (r.id === referral.id ? updated : r))
    );
    setEditingId(null);
    setEditForm({});

    // Write to EMR
    setStatus('saving');
    setError(null);
    const result = await upsertFhirReferral(updated);
    if (result.success) {
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } else {
      setReferrals(previousReferrals);
      setError(result.error || 'Failed to save');
      setStatus('error');
    }
  };

  if (!activePatient) return null;

  return (
    <div className="py-8 px-8">
      <div className="bg-white rounded-lg shadow-sm border p-8 w-full max-w-xl mx-auto">
          <h2 className="text-xl font-semibold mb-6">{referralView === 'pending' ? 'Pending Referrals' : 'Completed Referrals'}</h2>

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
              Saved
            </div>
          )}

          {status === 'saving' && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
              Saving...
            </div>
          )}

          {/* Loading state */}
          {status === 'loading' && (
            <div className="text-gray-400 text-sm text-center py-8">
              Loading referrals...
            </div>
          )}

          {/* Empty state */}
          {status !== 'loading' && filteredReferrals.length === 0 && status !== 'error' && (
            <div className="text-gray-400 text-sm text-center py-8">
              {referralView === 'pending' ? 'No pending referrals' : 'No completed referrals'}
            </div>
          )}

          {/* Referrals list */}
          {filteredReferrals.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 mb-2">
                {filteredReferrals.length} {referralView === 'pending' ? 'pending' : 'completed'} referral{filteredReferrals.length !== 1 ? 's' : ''} from EMR
              </p>
              {filteredReferrals.map((referral) => (
                <div
                  key={referral.id}
                  className="p-4 border border-gray-200 rounded-lg"
                >
                  {editingId === referral.id ? (
                    /* Edit mode */
                    <div className="space-y-3">
                      <p className="font-medium text-sm text-gray-900">{referral.referralType}</p>
                      {referral.referredTo && (
                        <p className="text-xs text-gray-500">Referred to: {referral.referredTo}</p>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          value={editForm.status || referral.status}
                          onChange={(e) => setEditForm({ ...editForm, status: e.target.value as AppReferral['status'] })}
                        >
                          <option value="draft">Draft</option>
                          <option value="active">Active</option>
                          <option value="completed">Completed</option>
                          <option value="revoked">Revoked</option>
                        </select>
                        <select
                          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          value={editForm.priority || referral.priority}
                          onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as AppReferral['priority'] })}
                        >
                          <option value="routine">Routine</option>
                          <option value="urgent">Urgent</option>
                          <option value="asap">ASAP</option>
                          <option value="stat">STAT</option>
                        </select>
                      </div>
                      <input
                        className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={editForm.note ?? referral.note ?? ''}
                        onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                        placeholder="Note"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSave(referral)}
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
                      onClick={() => handleEdit(referral)}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm text-gray-900">{referral.referralType}</p>
                        </div>
                        {referral.referredTo && (
                          <p className="text-xs text-gray-500 mt-1">
                            Referred to: {referral.referredTo}
                          </p>
                        )}
                        {referral.reason && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            Reason: {referral.reason}
                          </p>
                        )}
                        {referral.authoredOn && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Created: {new Date(referral.authoredOn).toLocaleDateString()}
                          </p>
                        )}
                        {referral.note && (
                          <p className="text-xs text-gray-400 mt-0.5">Note: {referral.note}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          referral.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : referral.status === 'draft'
                            ? 'bg-yellow-100 text-yellow-700'
                            : referral.status === 'completed'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {referral.status}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          referral.priority === 'stat'
                            ? 'bg-red-100 text-red-700'
                            : referral.priority === 'urgent' || referral.priority === 'asap'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {referral.priority}
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
              Changes will be saved to EMR
            </p>
          )}
      </div>
    </div>
  );
}
