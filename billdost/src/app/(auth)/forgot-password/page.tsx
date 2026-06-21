'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
    })

    if (resetError) {
      setError(resetError.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-[#0D2E1F] border border-[#1A6E45] rounded-2xl flex items-center justify-center mx-auto mb-5">
          <span className="text-3xl">🔑</span>
        </div>
        <h1
          className="text-2xl font-extrabold text-white tracking-tight mb-2"
          style={{ fontFamily: 'var(--font-display, "Syne", sans-serif)' }}
        >
          Reset link bhej diya! ✅
        </h1>
        <p className="text-[#9A9690] text-sm mb-6 max-w-xs mx-auto">
          <strong className="text-white">{email}</strong> pe reset link bheja hai.
          Link pe click karo aur naya password set karo.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => { setSent(false); setEmail(''); }}
            className="flex-1 py-3 bg-[#1E1C1A] border border-[#2E2C28] text-[#9A9690] rounded-xl text-sm hover:bg-[#252320] transition-colors"
          >
            Doosra email try karo
          </button>
          <Link
            href="/login"
            className="flex-1 py-3 bg-[#2BB673] text-white rounded-xl text-sm font-semibold text-center hover:bg-[#22A862] transition-colors"
          >
            Login Karo →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-8">
        <h1
          className="text-3xl font-extrabold text-white tracking-tight mb-2"
          style={{ fontFamily: 'var(--font-display, "Syne", sans-serif)' }}
        >
          Password bhool gaye? 🔐
        </h1>
        <p className="text-[#9A9690] text-sm">
          Koi baat nahi. Email daalo, reset link bhej denge.
        </p>
      </div>

      {/* Form */}
      <div className="bg-[#161513] border border-[#2E2C28] rounded-2xl p-6">
        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#9A9690] mb-1.5 tracking-wide">
              Registered Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="aapka@email.com"
              required
              className="w-full px-4 py-3 bg-[#1E1C1A] border border-[#2E2C28] rounded-xl text-white text-sm placeholder:text-[#5C5A56] outline-none focus:border-[#2BB673] transition-colors"
            />
          </div>

          {error && (
            <div className="bg-[#2E1A10] border border-[#E8622A]/30 text-[#E8622A] text-xs px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#2BB673] hover:bg-[#22A862] disabled:bg-[#1A6E45] disabled:cursor-wait text-white font-semibold rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Spinner />
                Bhej rahe hain...
              </>
            ) : (
              'Reset Link Bhejo →'
            )}
          </button>
        </form>
      </div>

      {/* Back to login */}
      <p className="text-center text-sm text-[#9A9690] mt-6">
        Password yaad aa gaya?{' '}
        <Link
          href="/login"
          className="text-[#2BB673] font-medium hover:text-[#22A862] transition-colors"
        >
          Login Karo →
        </Link>
      </p>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}
