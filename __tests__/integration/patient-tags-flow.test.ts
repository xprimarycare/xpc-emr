// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createAdminSession } from '../helpers/mocks'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    patientTag: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/auth', () => ({ auth: vi.fn() }))

import { GET, PUT } from '@/app/api/patient-tags/route'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const mockAuth = vi.mocked(auth)
const mockTagFindMany = vi.mocked((prisma as any).patientTag.findMany)
const mockTransaction = vi.mocked((prisma as any).$transaction)

describe('Patient Tags Flow Integration', () => {
  const adminSession = createAdminSession()

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(adminSession as any)
  })

  it('create tags -> read tags -> update tags', async () => {
    // Step 1: Create tags for a patient
    const txDeleteMany = vi.fn()
    const txCreateMany = vi.fn()
    mockTransaction.mockImplementation(async (fn: any) => {
      return fn({ patientTag: { deleteMany: txDeleteMany, createMany: txCreateMany } })
    })

    const createRes = await PUT(new NextRequest(new Request('http://localhost/api/patient-tags', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientFhirId: 'patient-1',
        tags: {
          conditions: ['COPD', 'Diabetes'],
          competencies: ['EPA 1'],
          contexts: ['Outpatient'],
        },
      }),
    })))
    expect(createRes.status).toBe(200)
    expect(mockTransaction).toHaveBeenCalled()
    // Verify transaction operations for initial create
    expect(txDeleteMany).toHaveBeenCalledTimes(3) // conditions, competencies, contexts
    expect(txCreateMany).toHaveBeenCalledWith({
      data: [
        { patientFhirId: 'patient-1', category: 'conditions', value: 'COPD' },
        { patientFhirId: 'patient-1', category: 'conditions', value: 'Diabetes' },
      ],
    })

    // Step 2: Read tags
    mockTagFindMany.mockResolvedValue([
      { patientFhirId: 'patient-1', category: 'conditions', value: 'COPD', createdAt: new Date() },
      { patientFhirId: 'patient-1', category: 'conditions', value: 'Diabetes', createdAt: new Date() },
      { patientFhirId: 'patient-1', category: 'competencies', value: 'EPA 1', createdAt: new Date() },
      { patientFhirId: 'patient-1', category: 'contexts', value: 'Outpatient', createdAt: new Date() },
    ])

    const readRes = await GET(new NextRequest(new Request(
      'http://localhost/api/patient-tags?patientFhirIds=patient-1'
    )))
    expect(readRes.status).toBe(200)
    const readJson = await readRes.json()
    expect(readJson['patient-1'].conditions).toEqual(['COPD', 'Diabetes'])
    expect(readJson['patient-1'].competencies).toEqual(['EPA 1'])
    expect(readJson['patient-1'].contexts).toEqual(['Outpatient'])

    // Step 3: Update only conditions — reset mocks to verify update-specific calls
    txDeleteMany.mockClear()
    txCreateMany.mockClear()

    const updateRes = await PUT(new NextRequest(new Request('http://localhost/api/patient-tags', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientFhirId: 'patient-1',
        tags: {
          conditions: ['COPD', 'Hypertension'],
        },
      }),
    })))
    expect(updateRes.status).toBe(200)
    expect(mockTransaction).toHaveBeenCalledTimes(2)
    // Verify only conditions category was touched in update
    expect(txDeleteMany).toHaveBeenCalledTimes(1)
    expect(txDeleteMany).toHaveBeenCalledWith({ where: { patientFhirId: 'patient-1', category: 'conditions' } })
    expect(txCreateMany).toHaveBeenCalledWith({
      data: [
        { patientFhirId: 'patient-1', category: 'conditions', value: 'COPD' },
        { patientFhirId: 'patient-1', category: 'conditions', value: 'Hypertension' },
      ],
    })
  })

  it('handles multiple patients independently', async () => {
    mockTagFindMany.mockResolvedValue([
      { patientFhirId: 'p1', category: 'conditions', value: 'COPD', createdAt: new Date() },
      { patientFhirId: 'p2', category: 'conditions', value: 'Asthma', createdAt: new Date() },
    ])

    const res = await GET(new NextRequest(new Request(
      'http://localhost/api/patient-tags?patientFhirIds=p1,p2'
    )))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.p1.conditions).toEqual(['COPD'])
    expect(json.p2.conditions).toEqual(['Asthma'])
  })
})
