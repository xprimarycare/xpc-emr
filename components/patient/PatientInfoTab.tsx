'use client';

import React, { useState, useEffect } from 'react';
import { usePatient } from '@/lib/context/PatientContext';

export function PatientInfoTab() {
  const { activePatient, updatePatient } = usePatient();
  const [formData, setFormData] = useState({
    name: '',
    mrn: '',
    dob: '',
    sex: ''
  });

  useEffect(() => {
    if (activePatient) {
      setFormData({
        name: activePatient.name || '',
        mrn: activePatient.mrn || '',
        dob: activePatient.dob || '',
        sex: activePatient.sex || ''
      });
    }
  }, [activePatient]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!activePatient) return;

    updatePatient(activePatient.id, {
      name: formData.name,
      mrn: formData.mrn || 'No info',
      dob: formData.dob,
      sex: formData.sex
    });
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!activePatient) return null;

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="flex items-center justify-center py-12">
        <div className="bg-white rounded-lg shadow-sm border p-8 w-full max-w-xl mx-8">
          <h2 className="text-xl font-semibold mb-6">Patient Information</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Patient Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                MRN
              </label>
              <input
                type="text"
                value={formData.mrn}
                onChange={(e) => handleChange('mrn', e.target.value)}
                placeholder="Medical Record Number"
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date of Birth
              </label>
              <input
                type="date"
                value={formData.dob}
                onChange={(e) => handleChange('dob', e.target.value)}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sex
              </label>
              <select
                value={formData.sex}
                onChange={(e) => handleChange('sex', e.target.value)}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Select...</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
            >
              Save Patient
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
