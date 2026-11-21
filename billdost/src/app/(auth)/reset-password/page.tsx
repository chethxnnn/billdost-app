'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

/**
 * Password reset completion (blueprint C13). The recovery email lands
 * on /auth/callback, which exchanges the code for a session and
 * redirects here; this page is where the new password is actually set.
 */
export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password kam se kam 6 characters ka hona chahiye.')
      return
    }
    if (password !== confirm) {
      setError('Dono password match nahi ho rahe.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError('Password set nahi ho paya. Reset link expire ho gaya ho to dobara request karo.')
      setLoading(false)
      return
    }

    setDone(true)
    setLoading(false)
    router.push('/dashboard')
    router.refresh()
  }

  if (done) {
    return (
      <div className="text-center">
        <h1
          className="text-2xl font-extrabold text-[#1D1D1F] dark:text-white tracking-tight mb-2"
          style={{ fontFamily: 'var(--font-display, "Syne", sans-serif)' }}
        >
          Password set ho gaya!
        </h1>
        <p className="text-[#6E6E73] dark:text-[#98989D] text-sm mb-6">
          Ab aap naye password se login kar sakte ho.
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-6 py-3 bg-[#1B7A4A] dark:bg-[#25D366] text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Dashboard par jao
        </Link>
      </div>
    )
  }

  return (
    <div>
      <h1
        className="text-2xl font-extrabold text-[#1D1D1F] dark:text-white tracking-tight mb-2"
        style={{ fontFamily: 'var(--font-display, "Syne", sans-serif)' }}
      >
        Naya password set karo
      </h1>
      <p className="text-[#6E6E73] dark:text-[#98989D] text-sm mb-6">
        Apne account ke liye ek naya password chuno.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-[#6E6E73] dark:text-[#98989D] uppercase tracking-wider mb-2">
            Naya Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-white dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] text-[#1D1D1F] dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1B7A4A]/20 transition-all"
            placeholder="Kam se kam 6 characters"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-[#6E6E73] dark:text-[#98989D] uppercase tracking-wider mb-2">
            Password Dobara Likho
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            className="w-full bg-white dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] text-[#1D1D1F] dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1B7A4A]/20 transition-all"
            placeholder="Wahi password dobara"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-[#1B7A4A] dark:bg-[#25D366] text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? 'Set ho raha hai...' : 'Password Set Karo'}
        </button>
      </form>

      <p className="text-center text-sm text-[#6E6E73] dark:text-[#98989D] mt-6">
        Galti se yahan aa gaye?{' '}
        <Link href="/login" className="text-[#1B7A4A] dark:text-[#25D366] font-semibold">
          Login par wapas jao
        </Link>
      </p>
    </div>
  )
}
