'use client'

import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  name: string | null
  email: string
  role: string
}

interface RowStatus {
  state: 'idle' | 'saving' | 'success' | 'error'
  message?: string
}

export function UserManagement({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [rowStatuses, setRowStatuses] = useState<Record<string, RowStatus>>({})
  const { update } = useSession()
  const router = useRouter()

  useEffect(() => {
    fetch('/api/user/list')
      .then((res) => res.json())
      .then((data) => setUsers(data.users ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleRoleChange = async (userId: string, newRole: string) => {
    setRowStatuses((prev) => ({ ...prev, [userId]: { state: 'saving' } }))

    try {
      const res = await fetch('/api/user/role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update role')
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      )
      setRowStatuses((prev) => ({ ...prev, [userId]: { state: 'success' } }))
      setTimeout(() => {
        setRowStatuses((prev) => ({ ...prev, [userId]: { state: 'idle' } }))
      }, 2000)
    } catch (err) {
      setRowStatuses((prev) => ({
        ...prev,
        [userId]: {
          state: 'error',
          message: err instanceof Error ? err.message : 'Something went wrong',
        },
      }))
    }
  }

  const handleImpersonate = async (userId: string) => {
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to impersonate')
      }

      // Pass the target userId to the JWT callback via update()
      await update({ impersonating: userId })
      router.push('/')
    } catch (err) {
      console.error('Impersonation failed:', err)
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Loading team members...</div>
  }

  return (
    <div className="space-y-3">
      {users.map((user) => {
        const status = rowStatuses[user.id] ?? { state: 'idle' }
        const isSelf = user.id === currentUserId

        return (
          <div
            key={user.id}
            className="flex items-center justify-between gap-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user.name || 'Unnamed'}
                {isSelf && (
                  <span className="text-gray-400 font-normal"> (you)</span>
                )}
              </p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                value={user.role}
                onChange={(e) => handleRoleChange(user.id, e.target.value)}
                disabled={isSelf || status.state === 'saving'}
                className="text-sm border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="user">Clinician</option>
                <option value="admin">Admin</option>
              </select>

              {!isSelf && user.role !== 'admin' && (
                <button
                  onClick={() => handleImpersonate(user.id)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Impersonate
                </button>
              )}

              {status.state === 'saving' && (
                <span className="text-xs text-gray-400 w-12">Saving...</span>
              )}
              {status.state === 'success' && (
                <span className="text-xs text-green-600 w-12">Saved</span>
              )}
              {status.state === 'error' && (
                <span className="text-xs text-red-600 w-12">{status.message}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
