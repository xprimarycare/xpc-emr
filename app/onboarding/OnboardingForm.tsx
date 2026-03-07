'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'

interface OnboardingFormProps {
  userName: string
  userEmail: string
}

export function OnboardingForm({ userName, userEmail }: OnboardingFormProps) {
  const [institution, setInstitution] = useState('')
  const [npi, setNpi] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
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
        throw new Error(data.error || 'Failed to save profile')
      }

      window.location.href = '/'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 rounded-md bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">Name</label>
        <input
          type="text"
          value={userName}
          disabled
          className="mt-1 w-full px-3 py-2 border rounded-md bg-gray-100 text-gray-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Email</label>
        <input
          type="email"
          value={userEmail}
          disabled
          className="mt-1 w-full px-3 py-2 border rounded-md bg-gray-100 text-gray-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Institution
        </label>
        <input
          type="text"
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
          placeholder="Optional — e.g., Metro General Hospital"
          className="mt-1 w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          NPI
        </label>
        <input
          type="text"
          value={npi}
          onChange={(e) => setNpi(e.target.value)}
          placeholder="Optional — 10-digit National Provider Identifier"
          className="mt-1 w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full cursor-pointer">
        {isSubmitting ? 'Saving...' : 'Complete Setup'}
      </Button>
    </form>
  )
}
