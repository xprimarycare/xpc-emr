'use client'

import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'

export function SignOutButton() {
  return (
    <Button
      variant="outline"
      className="w-full cursor-pointer"
      onClick={() => signOut({ callbackUrl: '/login' })}
    >
      Sign Out
    </Button>
  )
}
