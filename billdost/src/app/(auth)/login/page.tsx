'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  // The auth callback redirects here with ?error=auth_failed when a
  // sign-in or invite link fails; surface it instead of a blank form.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('error') === 'auth_failed') {
      setError('Login link kaam nahi kiya (expire ho gaya hoga). Email aur password se login karo, ya naya link mangwao.')
    }
  }, [])
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(
        authError.message === 'Invalid login credentials'
          ? 'Email ya password galat hai. Dobara try karo.'
          : authError.message
      )
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="text-center mb-10">
        <h1
          className="text-[32px] md:text-[40px] font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight leading-tight mb-3"
          style={{ fontFamily: 'var(--font-display, "Syne", sans-serif)' }}
        >
          Welcome back
        </h1>
        <p className="text-[15px] text-[#6E6E73] dark:text-[#98989D] font-medium">
          Sign in to access your dashboard
        </p>
      </div>

      {/* Form Container */}
      <div className="bg-white/70 dark:bg-[#1C1C1E]/70 backdrop-blur-2xl border border-black/5 dark:border-white/5 rounded-[32px] p-6 md:p-8 shadow-2xl shadow-black/5 dark:shadow-black/20 transition-all duration-300">
        <form onSubmit={handleLogin} className="space-y-5">
          {/* Email */}
          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-2 ml-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              className="w-full px-4 py-3.5 bg-white dark:bg-[#2C2C2E] border border-black/10 dark:border-white/10 rounded-2xl text-[15px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#6E6E73] dark:placeholder:text-[#98989D] outline-none focus:border-[#1B7A4A] dark:focus:border-[#25D366] focus:ring-4 focus:ring-[#1B7A4A]/10 dark:focus:ring-[#25D366]/10 transition-all duration-300"
            />
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-2 mx-1">
              <label className="block text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-[13px] font-semibold text-[#1B7A4A] dark:text-[#25D366] hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full px-4 py-3.5 bg-white dark:bg-[#2C2C2E] border border-black/10 dark:border-white/10 rounded-2xl text-[15px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#6E6E73] dark:placeholder:text-[#98989D] outline-none focus:border-[#1B7A4A] dark:focus:border-[#25D366] focus:ring-4 focus:ring-[#1B7A4A]/10 dark:focus:ring-[#25D366]/10 transition-all duration-300"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-[#FF3B30]/10 dark:bg-[#FF453A]/10 border border-[#FF3B30]/20 dark:border-[#FF453A]/20 text-[#FF3B30] dark:text-[#FF453A] text-[14px] font-medium px-4 py-3 rounded-2xl flex items-start gap-2 animate-in slide-in-from-top-2 duration-300">
              <span className="mt-0.5">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 mt-2 bg-[#1B7A4A] dark:bg-[#25D366] hover:bg-[#155F3A] dark:hover:bg-[#1DA951] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100 text-white dark:text-[#1D1D1F] font-bold text-[15px] rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 shadow-sm shadow-[#1B7A4A]/20"
          >
            {loading ? (
              <>
                <Spinner />
                <span>Signing in...</span>
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>

      {/* Sign up link */}
      <p className="text-center text-[15px] font-medium text-[#6E6E73] dark:text-[#98989D] mt-8">
        Don't have an account?{' '}
        <Link
          href="/signup"
          className="text-[#1B7A4A] dark:text-[#25D366] font-bold hover:underline underline-offset-4"
        >
          Sign up now
        </Link>
      </p>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}

