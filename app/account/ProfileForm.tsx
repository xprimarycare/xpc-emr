'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface ProfileFormProps {
  institution: string | null
  npi: string | null
}

export function ProfileForm({ institution: initialInstitution, npi: initialNpi }: ProfileFormProps) {
  const router = useRouter()
  const [institution, setInstitution] = useState(initialInstitution || '')
  const [npi, setNpi] = useState(initialNpi || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setStatus('idle')
    setError('')

    try {
      const response = await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institution: institution || undefined,
          npi: npi || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save')
      }

      setStatus('success')
      router.refresh()
      setTimeout(() => setStatus('idle'), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
          Institution
        </label>
        <input
          type="text"
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
          placeholder="e.g., Metro General Hospital"
          className="mt-1 w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
          NPI
        </label>
        <input
          type="text"
          value={npi}
          onChange={(e) => setNpi(e.target.value)}
          placeholder="10-digit National Provider Identifier"
          className="mt-1 w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {status === 'error' && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <Button type="submit" disabled={isSubmitting} className="w-full cursor-pointer">
        {isSubmitting ? 'Saving...' : status === 'success' ? 'Saved!' : 'Save Changes'}
      </Button>
    </form>
  )
}
