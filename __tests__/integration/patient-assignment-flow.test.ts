// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createMockSession, createAdminSession } from '../helpers/mocks'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    userPatient: { findMany: vi.fn(), upsert: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  },
}))
vi.mock('@/auth', () => ({ auth: vi.fn() }))

import { GET, POST, PATCH, DELETE } from '@/app/api/user/patients/route'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const mockAuth = vi.mocked(auth)
const mockUserFindUnique = vi.mocked((prisma as any).user.findUnique)
const mockFindMany = vi.mocked((prisma as any).userPatient.findMany)
const mockUpsert = vi.mocked((prisma as any).userPatient.upsert)
const mockUpdateMany = vi.mocked((prisma as any).userPatient.updateMany)
const mockDeleteMany = vi.mocked((prisma as any).userPatient.deleteMany)

function makeRequest(method: string, body?: any) {
  return new NextRequest(new Request('http://localhost/api/user/patients', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }))
}

describe('Patient Assignment Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('full lifecycle: assign -> list -> transition -> complete -> unassign', async () => {
    const session = createMockSession()
    mockAuth.mockResolvedValue(session as any)

    // Step 1: Assign patient
    mockUpsert.mockResolvedValue({
      id: 'a1', userId: 'user-1', patientFhirId: 'patient-fhir-1',
      status: 'waiting_room', assignedAt: new Date(),
    } as any)

    const assignRes = await POST(makeRequest('POST', { patientFhirId: 'patient-fhir-1' }))
    expect(assignRes.status).toBe(200)

    // Step 2: List assignments
    mockFindMany.mockResolvedValue([
      {
        patientFhirId: 'patient-fhir-1',
        status: 'waiting_room',
        assignedAt: new Date(),
        assignedBy: null,
        encounterFhirId: null,
        sourceEncounterFhirId: null,
        sourcePatientFhirId: null,
        includeNoteText: null,
      },
    ])

    const listRes = await GET()
    expect(listRes.status).toBe(200)
    const listJson = await listRes.json()
    expect(listJson.patientFhirIds).toContain('patient-fhir-1')

    // Step 3: Transition waiting_room -> in_progress
    mockUpdateMany.mockResolvedValue({ count: 1 })
    const progressRes = await PATCH(makeRequest('PATCH', {
      patientFhirId: 'patient-fhir-1',
      status: 'in_progress',
    }))
    expect(progressRes.status).toBe(200)

    // Step 4: Transition in_progress -> completed
    mockUpdateMany.mockResolvedValue({ count: 1 })
    const completeRes = await PATCH(makeRequest('PATCH', {
      patientFhirId: 'patient-fhir-1',
      status: 'completed',
    }))
    expect(completeRes.status).toBe(200)

    // Step 5: Unassign patient
    mockDeleteMany.mockResolvedValue({ count: 1 })
    const deleteRes = await DELETE(makeRequest('DELETE', { patientFhirId: 'patient-fhir-1' }))
    expect(deleteRes.status).toBe(200)
  })

  it('admin can assign to another user', async () => {
    mockAuth.mockResolvedValue(createAdminSession() as any)
    mockUserFindUnique.mockResolvedValue({ id: 'u2', onboardingComplete: true } as any)
    mockUpsert.mockResolvedValue({ id: 'a1' } as any)

    const res = await POST(makeRequest('POST', {
      patientFhirId: 'patient-fhir-1',
      userId: 'u2',
    }))
    expect(res.status).toBe(200)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_patientFhirId: {
            userId: 'u2',
            patientFhirId: 'patient-fhir-1',
          },
        },
      })
    )
  })

  it('invalid status transition is rejected', async () => {
    mockAuth.mockResolvedValue(createMockSession() as any)
    const res = await PATCH(makeRequest('PATCH', {
      patientFhirId: 'patient-fhir-1',
      status: 'waiting_room',
    }))
    expect(res.status).toBe(400)
  })
})
