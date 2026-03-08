// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createAdminSession } from '../helpers/mocks'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findMany: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    impersonationLog: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  },
}))
vi.mock('@/auth', () => ({ auth: vi.fn() }))

import { GET as listUsers } from '@/app/api/user/list/route'
import { PATCH as updateRole } from '@/app/api/user/role/route'
import { POST as impersonate } from '@/app/api/admin/impersonate/route'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const mockAuth = vi.mocked(auth)
const mockUserFindMany = vi.mocked((prisma as any).user.findMany)
const mockUserUpdate = vi.mocked((prisma as any).user.update)
const mockUserFindUnique = vi.mocked((prisma as any).user.findUnique)
const mockLogCreate = vi.mocked((prisma as any).impersonationLog.create)
const mockLogFindFirst = vi.mocked((prisma as any).impersonationLog.findFirst)
const mockLogUpdate = vi.mocked((prisma as any).impersonationLog.update)

function makeRequest(method: string, body: any, url = 'http://localhost/api/test') {
  return new NextRequest(new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }))
}

describe('Admin Flow Integration', () => {
  const adminSession = createAdminSession()

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(adminSession as any)
  })

  it('list users -> change role -> impersonate -> stop', async () => {
    // Step 1: List users
    mockUserFindMany.mockResolvedValue([
      { id: 'u1', name: 'Alice', email: 'alice@test.com', role: 'user' },
      { id: 'u2', name: 'Bob', email: 'bob@test.com', role: 'user' },
    ])

    const listRes = await listUsers()
    expect(listRes.status).toBe(200)
    const { users } = await listRes.json()
    expect(users).toHaveLength(2)

    // Step 2: Change Alice's role to admin
    mockUserUpdate.mockResolvedValue({} as any)
    const roleRes = await updateRole(makeRequest('PATCH', { userId: 'u1', role: 'admin' }))
    expect(roleRes.status).toBe(200)
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { role: 'admin' },
    })

    // Step 3: Start impersonating Bob
    mockUserFindUnique.mockResolvedValue({ id: 'u2', name: 'Bob' } as any)
    mockLogCreate.mockResolvedValue({} as any)

    const startRes = await impersonate(makeRequest('POST', { userId: 'u2' }))
    expect(startRes.status).toBe(200)
    const startJson = await startRes.json()
    expect(startJson.targetUserName).toBe('Bob')
    expect(mockLogCreate).toHaveBeenCalledWith({
      data: { adminId: 'admin-1', targetUserId: 'u2' },
    })

    // Step 4: Stop impersonation
    const impersonatingSession = {
      user: { ...adminSession.user, id: 'u2', role: 'user', originalAdminId: 'admin-1' },
      expires: adminSession.expires,
    }
    mockAuth.mockResolvedValue(impersonatingSession as any)
    mockLogFindFirst.mockResolvedValue({ id: 'log-1' } as any)
    mockLogUpdate.mockResolvedValue({} as any)

    const stopRes = await impersonate(makeRequest('POST', {}))
    expect(stopRes.status).toBe(200)
    expect(mockLogUpdate).toHaveBeenCalledWith({
      where: { id: 'log-1' },
      data: { endedAt: expect.any(Date) },
    })
  })
})
