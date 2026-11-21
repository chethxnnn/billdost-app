'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { inputCls, labelCls } from '@/components/ui'

/**
 * Portal login (plan Section 7): one centred card, one job. There is
 * no signup link here and never will be. A valid Supabase login that
 * is not an active admin gets one plain message and is signed straight
 * back out.
 */
export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (signInError) {
      setError('Email ya password galat hai. Dobara try karo.')
      setLoading(false)
      return
    }

    const res = await fetch('/api/me')
    if (!res.ok) {
      await supabase.auth.signOut()
      setError('This area is for the BillDost team. This login does not have portal access.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px] page-enter">
        <div className="text-center mb-8">
          <p className="font-extrabold text-[32px] tracking-[-0.02em]">BillDost</p>
          <p className="text-[13px] font-bold uppercase tracking-widest text-[#86868B] mt-1">
            Admin
          </p>
        </div>

        <div className="bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded-[24px] p-7 shadow-xl shadow-black/[0.04]">
          <h1 className="text-[20px] font-bold tracking-tight mb-1">Sign in</h1>
          <p className="text-[14px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium mb-6">
            Team members only. Shop logins do not work here.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelCls} htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className={inputCls}
                placeholder="you@billdost.in"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className={inputCls}
                placeholder="Your password"
              />
            </div>
            {error ? (
              <p className="text-[14px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-2xl px-4 py-3">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#1B7A4A] hover:bg-[#155F3A] active:scale-[0.98] disabled:opacity-60 text-white font-bold text-[15px] rounded-full transition-all duration-200 shadow-sm shadow-[#1B7A4A]/20"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
