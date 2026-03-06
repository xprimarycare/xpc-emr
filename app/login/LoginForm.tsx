'use client'

import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'

export function LoginForm() {
  const searchParams = useSearchParams()
  const rawCallback = searchParams.get('callbackUrl') || '/'
  const callbackUrl = (() => {
    try {
      const parsed = new URL(rawCallback, window.location.origin)
      return parsed.origin === window.location.origin ? parsed.pathname + parsed.search : '/'
    } catch {
      return '/'
    }
  })()
  const urlError = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [credentialsError, setCredentialsError] = useState('')

  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setCredentialsError('')
    const result = await signIn('credentials', { email, password, redirect: false })
    if (result?.error) {
      setCredentialsError('Invalid email or password.')
      setIsLoading(false)
    } else {
      window.location.href = callbackUrl
    }
  }

  const errorMessage = (() => {
    if (credentialsError) return credentialsError
    if (!urlError) return null
    if (urlError === 'OAuthAccountNotLinked')
      return 'This email is already associated with another account.'
    if (urlError === 'CredentialsSignin')
      return 'Invalid email or password.'
    return 'An error occurred during sign in. Please try again.'
  })()

  return (
    <div className="space-y-6">
      {errorMessage && (
        <div className="p-3 rounded-md bg-red-50 text-red-700 text-sm">
          {errorMessage}
        </div>
      )}
      <Button
        onClick={() => signIn('google', { callbackUrl })}
        variant="outline"
        className="w-full h-12 text-base cursor-pointer"
      >
        <GoogleIcon />
        Sign in with Google
      </Button>
      <p className="text-xs text-center text-gray-400">
        Sign in with your institutional Google account to access patient records.
      </p>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-2 text-gray-400">or</span>
        </div>
      </div>

      <form onSubmit={handleCredentialsSignIn} className="space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            className="w-full px-3 py-2 pr-10 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        <Button
          type="submit"
          variant="ghost"
          disabled={isLoading}
          className="w-full text-sm text-gray-500 cursor-pointer"
        >
          {isLoading ? 'Signing in...' : 'Sign in with email'}
        </Button>
      </form>

      <p className="text-xs text-center text-gray-400">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-blue-500 hover:underline">
          Register
        </Link>
      </p>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg className="size-5 mr-2" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}
