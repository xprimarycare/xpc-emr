// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createAdminSession, createMockSession } from '../../helpers/mocks'

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { update: vi.fn() } },
}))
vi.mock('@/auth', () => ({ auth: vi.fn() }))

import { PATCH } from '@/app/api/user/role/route'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const mockAuth = vi.mocked(auth)
const mockUserUpdate = vi.mocked((prisma as any).user.update)

function makeRequest(body: any) {
  return new NextRequest(new Request('http://localhost/api/user/role', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

describe('PATCH /api/user/role', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const res = await PATCH(makeRequest({ userId: 'u2', role: 'admin' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin', async () => {
    mockAuth.mockResolvedValue(createMockSession() as any)
    const res = await PATCH(makeRequest({ userId: 'u2', role: 'admin' }))
    expect(res.status).toBe(403)
  })

  it('returns 400 when userId missing', async () => {
    mockAuth.mockResolvedValue(createAdminSession() as any)
    const res = await PATCH(makeRequest({ role: 'admin' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when role missing', async () => {
    mockAuth.mockResolvedValue(createAdminSession() as any)
    const res = await PATCH(makeRequest({ userId: 'u2' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid role', async () => {
    mockAuth.mockResolvedValue(createAdminSession() as any)
    const res = await PATCH(makeRequest({ userId: 'u2', role: 'superadmin' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when trying to change own role', async () => {
    mockAuth.mockResolvedValue(createAdminSession() as any)
    const res = await PATCH(makeRequest({ userId: 'admin-1', role: 'user' }))
    expect(res.status).toBe(400)
  })

  it('updates role successfully', async () => {
    mockAuth.mockResolvedValue(createAdminSession() as any)
    mockUserUpdate.mockResolvedValue({} as any)
    const res = await PATCH(makeRequest({ userId: 'u2', role: 'admin' }))
    expect(res.status).toBe(200)
    expect(mockUserUpdate).toHaveBeenCalledWith({ where: { id: 'u2' }, data: { role: 'admin' } })
  })

  it('returns 404 for P2025 error', async () => {
    mockAuth.mockResolvedValue(createAdminSession() as any)
    mockUserUpdate.mockRejectedValue({ code: 'P2025' })
    const res = await PATCH(makeRequest({ userId: 'x', role: 'admin' }))
    expect(res.status).toBe(404)
  })

  it('returns 500 for unexpected errors', async () => {
    mockAuth.mockResolvedValue(createAdminSession() as any)
    mockUserUpdate.mockRejectedValue(new Error('DB down'))
    const res = await PATCH(makeRequest({ userId: 'u2', role: 'admin' }))
    expect(res.status).toBe(500)
  })
})
