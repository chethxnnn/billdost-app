'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
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
        <p className="text-[15px] text-[#86868B] dark:text-[#98989D] font-medium">
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
              className="w-full px-4 py-3.5 bg-white dark:bg-[#2C2C2E] border border-black/10 dark:border-white/10 rounded-2xl text-[15px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#86868B] dark:placeholder:text-[#98989D] outline-none focus:border-[#1B7A4A] dark:focus:border-[#25D366] focus:ring-4 focus:ring-[#1B7A4A]/10 dark:focus:ring-[#25D366]/10 transition-all duration-300"
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
              className="w-full px-4 py-3.5 bg-white dark:bg-[#2C2C2E] border border-black/10 dark:border-white/10 rounded-2xl text-[15px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#86868B] dark:placeholder:text-[#98989D] outline-none focus:border-[#1B7A4A] dark:focus:border-[#25D366] focus:ring-4 focus:ring-[#1B7A4A]/10 dark:focus:ring-[#25D366]/10 transition-all duration-300"
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

        {/* Divider */}
        <div className="flex items-center gap-4 my-7">
          <div className="flex-1 h-[1px] bg-black/5 dark:bg-white/10" />
          <span className="text-[12px] font-medium text-[#86868B] dark:text-[#98989D] uppercase tracking-wider">or continue with</span>
          <div className="flex-1 h-[1px] bg-black/5 dark:bg-white/10" />
        </div>

        {/* Google OAuth (future) */}
        <button
          type="button"
          disabled
          className="w-full py-3.5 bg-transparent border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.98] text-[#1D1D1F] dark:text-[#F5F5F7] font-semibold rounded-2xl text-[15px] flex items-center justify-center gap-3 transition-all duration-300 opacity-60 cursor-not-allowed"
        >
          <GoogleIcon />
          <span>Google (Coming soon)</span>
        </button>
      </div>

      {/* Sign up link */}
      <p className="text-center text-[15px] font-medium text-[#86868B] dark:text-[#98989D] mt-8">
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

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}
