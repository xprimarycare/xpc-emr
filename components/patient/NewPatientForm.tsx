'use client';

import React, { useState } from 'react';
import { usePatient } from '@/lib/context/PatientContext';
import { PatientData } from '@/lib/types/patient';

export function NewPatientForm({ patientId }: { patientId: string }) {
  const { updatePatient } = usePatient();
  const [formData, setFormData] = useState({
    name: 'New Patient',
    mrn: '',
    dob: '',
    sex: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const updatedPatient: Partial<PatientData> = {
      name: formData.name,
      mrn: formData.mrn || 'TBD',
      dob: formData.dob || 'Unknown',
      sex: formData.sex || 'Unknown',
      summary: '',
      tabs: [
        {
          id: `tab-${patientId}-1`,
          name: 'Patient Info',
          content: '',
          section: 'pages' as const
        }
      ]
    };

    updatePatient(patientId, updatedPatient);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="bg-white rounded-lg shadow-sm border p-8 w-full max-w-xl">
        <h2 className="text-xl font-semibold mb-6">Patient Information</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Patient Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              MRN
            </label>
            <input
              type="text"
              value={formData.mrn}
              onChange={(e) => setFormData({ ...formData, mrn: e.target.value })}
              placeholder="Medical Record Number"
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Date of Birth
            </label>
            <input
              type="date"
              value={formData.dob}
              onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
              placeholder="mm/dd/yyyy"
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Sex
            </label>
            <select
              value={formData.sex}
              onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
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
  );
}
