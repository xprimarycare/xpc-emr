'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { STATUS_BADGE, CaseStatus, formatDateTime } from '@/lib/constants/case-status'
import type { CaseStatusValue } from '@/lib/constants/case-status'

interface Clinician {
  id: string
  name: string | null
  email?: string
  institution?: string | null
}

interface PatientSearchResult {
  id: string
  name: string
}

interface AssignmentRow {
  id: string
  patientFhirId: string
  patientName: string
  clinicianId: string
  clinicianName: string
  status: string
  assignedAt: string
  assignedByName: string | null
  encounterFhirId?: string
}

type Mode = 'patient-to-clinicians' | 'clinicians-to-patient'

export function AssignmentManagement() {
  const [mode, setMode] = useState<Mode>('patient-to-clinicians')
  const [clinicians, setClinicians] = useState<Clinician[]>([])
  const [loadingClinicians, setLoadingClinicians] = useState(true)

  // Assignment form state
  const [patientSearch, setPatientSearch] = useState('')
  const [patientResults, setPatientResults] = useState<PatientSearchResult[]>([])
  const [searchingPatients, setSearchingPatients] = useState(false)
  const [selectedPatients, setSelectedPatients] = useState<PatientSearchResult[]>([])
  const [selectedClinicians, setSelectedClinicians] = useState<Set<string>>(new Set())
  const [includeNoteText, setIncludeNoteText] = useState(true)
  const [assigning, setAssigning] = useState(false)
  const [assignResult, setAssignResult] = useState<string | null>(null)

  // Assignments table
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [loadingAssignments, setLoadingAssignments] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [tableSearch, setTableSearch] = useState('')

  // Load clinicians
  useEffect(() => {
    fetch('/api/user/list')
      .then((res) => res.json())
      .then((data) => setClinicians(data.users ?? []))
      .catch(() => {})
      .finally(() => setLoadingClinicians(false))
  }, [])

  // Load assignments
  const fetchAssignments = useCallback(() => {
    setLoadingAssignments(true)
    fetch('/api/case-library?view=assignments')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setAssignments(data)
      })
      .catch(() => {})
      .finally(() => setLoadingAssignments(false))
  }, [])

  useEffect(() => {
    fetchAssignments()
  }, [fetchAssignments])

  // Patient search
  useEffect(() => {
    if (!patientSearch.trim() || patientSearch.trim().length < 2) {
      setPatientResults([])
      return
    }
    const timeout = setTimeout(async () => {
      setSearchingPatients(true)
      try {
        const res = await fetch(`/api/fhir/patient?name=${encodeURIComponent(patientSearch.trim())}`)
        if (res.ok) {
          const bundle = await res.json()
          const results = ((bundle?.entry || []) as any[]).map((e: any) => {
            const r = e.resource
            const name = r?.name?.[0]
            const given = name?.given?.join(' ') || ''
            const family = name?.family || ''
            return {
              id: r.id,
              name: [given, family].filter(Boolean).join(' ') || 'Unknown',
            }
          })
          setPatientResults(results)
        }
      } catch {
        // ignore
      } finally {
        setSearchingPatients(false)
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [patientSearch])

  const toggleClinician = (id: string) => {
    setSelectedClinicians((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const addPatientToSelection = (patient: PatientSearchResult) => {
    if (!selectedPatients.find((p) => p.id === patient.id)) {
      setSelectedPatients((prev) => [...prev, patient])
    }
    setPatientSearch('')
    setPatientResults([])
  }

  const removePatient = (id: string) => {
    setSelectedPatients((prev) => prev.filter((p) => p.id !== id))
  }

  const handleAssign = async () => {
    const clinicianIds = Array.from(selectedClinicians)

    if (selectedPatients.length === 0 || clinicianIds.length === 0) return

    setAssigning(true)
    setAssignResult(null)

    const allResults = await Promise.all(
      selectedPatients.map(async (patient) => {
        try {
          const res = await fetch('/api/case-library/assign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              patientFhirId: patient.id,
              clinicianIds,
              includeNoteText,
            }),
          })
          const data = await res.json()
          return (data.results || []) as Array<{ success: boolean }>
        } catch {
          return Array(clinicianIds.length).fill({ success: false })
        }
      })
    )

    const flat = allResults.flat()
    const successCount = flat.filter((r) => r.success).length
    const errorCount = flat.filter((r) => !r.success).length

    setAssignResult(
      `${successCount} assignment${successCount !== 1 ? 's' : ''} created` +
        (errorCount > 0 ? `, ${errorCount} failed` : '')
    )
    setAssigning(false)
    setSelectedPatients([])
    setSelectedClinicians(new Set())
    fetchAssignments()
  }

  // Filter assignments table
  const filteredAssignments = assignments.filter((a) => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase()
      return (
        a.patientName.toLowerCase().includes(q) ||
        a.clinicianName.toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div className="space-y-8">
      {/* Mode tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('patient-to-clinicians')}
          className={`px-4 py-2 text-sm rounded-md ${
            mode === 'patient-to-clinicians'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Patient &rarr; Clinicians
        </button>
        <button
          onClick={() => setMode('clinicians-to-patient')}
          className={`px-4 py-2 text-sm rounded-md ${
            mode === 'clinicians-to-patient'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Clinicians &rarr; Patient
        </button>
      </div>

      {/* Assignment form */}
      <div className="border rounded-lg p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">
          {mode === 'patient-to-clinicians'
            ? 'Assign Patient to Multiple Clinicians'
            : 'Assign Multiple Patients to Clinician'}
        </h3>

        {/* Patient search */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            {mode === 'patient-to-clinicians' ? 'Search patient' : 'Search patients'}
          </label>
          <div className="relative">
            <input
              type="text"
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              placeholder="Type patient name..."
              className="w-full text-sm border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchingPatients && (
              <div className="absolute right-3 top-2.5 text-xs text-gray-400">Searching...</div>
            )}
            {patientResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-40 overflow-y-auto">
                {patientResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addPatientToSelection(p)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50"
                  >
                    {p.name}
                    <span className="text-xs text-gray-400 ml-2">{p.id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected patients */}
          {selectedPatients.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {selectedPatients.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded"
                >
                  {p.name}
                  <button
                    onClick={() => removePatient(p.id)}
                    className="text-blue-400 hover:text-blue-600"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Clinician selection */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            {mode === 'patient-to-clinicians' ? 'Select clinicians' : 'Select clinician'}
          </label>
          {loadingClinicians ? (
            <div className="text-sm text-gray-400">Loading clinicians...</div>
          ) : (
            <div className="max-h-40 overflow-y-auto border rounded-md divide-y">
              {clinicians.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type={mode === 'patient-to-clinicians' ? 'checkbox' : 'radio'}
                    name="clinician"
                    checked={selectedClinicians.has(c.id)}
                    onChange={() => {
                      if (mode === 'clinicians-to-patient') {
                        setSelectedClinicians(new Set([c.id]))
                      } else {
                        toggleClinician(c.id)
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">{c.name || c.email || c.id}</span>
                  {(c.institution || c.email) && (
                    <span className="text-xs text-gray-400 ml-1">
                      {[c.institution, c.email].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Clone options */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Encounter options
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="radio"
                name="noteText"
                checked={includeNoteText}
                onChange={() => setIncludeNoteText(true)}
              />
              Include note text
            </label>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="radio"
                name="noteText"
                checked={!includeNoteText}
                onChange={() => setIncludeNoteText(false)}
              />
              Blank encounter
            </label>
          </div>
        </div>

        {/* Assign button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleAssign}
            disabled={selectedPatients.length === 0 || selectedClinicians.size === 0 || assigning}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
          >
            {assigning ? 'Assigning...' : 'Assign'}
          </button>
          {assignResult && (
            <span className="text-sm text-green-600">{assignResult}</span>
          )}
        </div>
      </div>

      {/* Assignments table */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">All Assignments</h3>

        {/* Filters */}
        <div className="flex gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All statuses</option>
            <option value={CaseStatus.WAITING_ROOM}>Waiting Room</option>
            <option value={CaseStatus.IN_PROGRESS}>In Progress</option>
            <option value={CaseStatus.COMPLETED}>Completed</option>
          </select>
          <input
            type="text"
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            placeholder="Search patient or clinician..."
            className="flex-1 text-sm border rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Table */}
        {loadingAssignments ? (
          <div className="text-sm text-gray-400">Loading assignments...</div>
        ) : filteredAssignments.length === 0 ? (
          <div className="text-sm text-gray-400">No assignments found</div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium text-gray-600">Patient</th>
                  <th className="px-3 py-2 font-medium text-gray-600">Clinician</th>
                  <th className="px-3 py-2 font-medium text-gray-600">Status</th>
                  <th className="px-3 py-2 font-medium text-gray-600">Assigned</th>
                  <th className="px-3 py-2 font-medium text-gray-600">By</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredAssignments.map((a) => {
                  const badge = STATUS_BADGE[a.status as CaseStatusValue] || STATUS_BADGE[CaseStatus.WAITING_ROOM]
                  return (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">{a.patientName}</td>
                      <td className="px-3 py-2">{a.clinicianName}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs ${badge.bg} ${badge.text} px-1.5 py-0.5 rounded`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-500">{formatDateTime(a.assignedAt)}</td>
                      <td className="px-3 py-2 text-gray-500">{a.assignedByName || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
