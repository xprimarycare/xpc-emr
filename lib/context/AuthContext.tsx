'use client'

import { ReactNode } from 'react'
import { SessionProvider, useSession } from 'next-auth/react'
import type { Session } from 'next-auth'

export function AuthProvider({
  children,
  session,
}: {
  children: ReactNode
  session: Session | null
}) {
  return (
    <SessionProvider session={session}>
      {children}
    </SessionProvider>
  )
}

export function useAuth() {
  const sessionData = useSession()

  if (sessionData.status === 'loading') {
    return {
      ...sessionData,
      user: null,
      isAuthenticated: false,
      isLoading: true,
    }
  }

  return {
    ...sessionData,
    user: sessionData.data?.user ?? null,
    isAuthenticated: sessionData.status === 'authenticated',
    isLoading: false,
  }
}
