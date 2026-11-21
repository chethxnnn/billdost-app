'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

/**
 * The activation page (Admin Portal plan, Section 4). One job: check
 * the link, and when it is live, let the owner set his own password
 * and walk into his ready shop. Every dead-link state is a calm page
 * with the support number, never an error code. The page deliberately
 * does not say which check failed for a changed or tampered link.
 */
type Phase =
  | 'checking'
  | 'valid'
  | 'expired'
  | 'used'
  | 'replaced'
  | 'suspended'
  | 'invalid'

export default function ActivateForm({ token }: { token: string }) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('checking')
  const [shopName, setShopName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [supportPhone, setSupportPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/activate/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = await res.json()
        if (cancelled) return
        setSupportPhone(data.support_phone ?? '')
        setShopName(data.shop_name ?? '')
        setOwnerName(data.owner_name ?? '')
        const state = (data.state ?? 'invalid') as Phase
        setPhase(
          ['valid', 'expired', 'used', 'replaced', 'suspended'].includes(state)
            ? state
            : 'invalid'
        )
      } catch {
        if (!cancelled) setPhase('invalid')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password kam se kam 8 characters ka hona chahiye.')
      return
    }
    if (password !== confirm) {
      setError('Dono password ek jaise nahi hain. Dobara check karo.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/activate/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!data.ok) {
        if (data.state === 'weak_password') {
          setError('Password kam se kam 8 characters ka hona chahiye.')
          setSubmitting(false)
          return
        }
        const state = (data.state ?? 'invalid') as Phase
        setPhase(
          ['expired', 'used', 'replaced', 'suspended'].includes(state)
            ? state
            : 'invalid'
        )
        setSubmitting(false)
        return
      }
      // Account created and token burned: sign in and walk in.
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password,
      })
      if (signInError) {
        router.push('/login')
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Kuch gadbad ho gayi. Dobara try karo.')
      setSubmitting(false)
    }
  }

  const card =
    'w-full max-w-[440px] bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 rounded-[32px] p-8 md:p-10 shadow-2xl shadow-black/5'

  function deadLink(title: string, body: string, showLogin = false) {
    return (
      <div className={card + ' text-center'}>
        <div className="w-20 h-20 bg-[#1B7A4A]/10 dark:bg-[#25D366]/10 rounded-[24px] flex items-center justify-center mx-auto mb-6 text-4xl">
          🔗
        </div>
        <h1 className="text-[26px] font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight mb-3">
          {title}
        </h1>
        <p className="text-[15px] text-[#6E6E73] dark:text-[#98989D] font-medium leading-relaxed mb-8">
          {body}
        </p>
        <div className="flex flex-col gap-3">
          {supportPhone ? (
            <a
              href={`tel:${supportPhone.replace(/\s/g, '')}`}
              className="w-full py-4 bg-[#1B7A4A] dark:bg-[#25D366] hover:bg-[#155F3A] dark:hover:bg-[#1DA951] active:scale-[0.98] text-white dark:text-[#1D1D1F] font-bold text-[15px] rounded-2xl transition-all duration-300"
            >
              Call us: {supportPhone}
            </a>
          ) : null}
          {showLogin ? (
            <Link
              href="/login"
              className="w-full py-4 bg-transparent border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.98] text-[#1D1D1F] dark:text-[#F5F5F7] font-semibold rounded-2xl text-[15px] transition-all duration-300 text-center"
            >
              Go to login
            </Link>
          ) : null}
        </div>
      </div>
    )
  }

  if (phase === 'checking') {
    return (
      <div className={card + ' text-center'}>
        <p className="text-[15px] text-[#6E6E73] dark:text-[#98989D] font-medium">
          Aapka link check ho raha hai...
        </p>
      </div>
    )
  }

  if (phase === 'expired' || phase === 'invalid') {
    return deadLink(
      'This link has expired',
      'Call us and we will send a fresh one in a minute. Your shop is safe and ready.'
    )
  }
  if (phase === 'replaced') {
    return deadLink(
      'A newer link is on its way',
      'This link was replaced by a fresh one. Please use the latest link we sent you, or call us and we will send it again.'
    )
  }
  if (phase === 'used') {
    return deadLink(
      'This shop is already activated',
      'Your shop is live. Just log in with the password you set.',
      true
    )
  }
  if (phase === 'suspended') {
    return deadLink(
      'Your shop is paused',
      'Please call us and we will sort it out together. Your data is completely safe.'
    )
  }

  return (
    <div className={card}>
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-[#1B7A4A]/10 dark:bg-[#25D366]/10 rounded-[24px] flex items-center justify-center mx-auto mb-6 text-4xl">
          🏪
        </div>
        <h1 className="text-[26px] font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight mb-2">
          {shopName || 'Your shop'}
        </h1>
        <p className="text-[15px] text-[#6E6E73] dark:text-[#98989D] font-medium leading-relaxed">
          {ownerName ? `Namaste ${ownerName}. ` : 'Namaste. '}
          Your shop is ready. Set your password to enter.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-2 ml-1">
            New password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Kam se kam 8 characters"
            autoComplete="new-password"
            required
            className="w-full px-4 py-3.5 bg-white dark:bg-[#2C2C2E] border border-black/10 dark:border-white/10 rounded-2xl text-[15px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#6E6E73] dark:placeholder:text-[#98989D] outline-none focus:border-[#1B7A4A] dark:focus:border-[#25D366] focus:ring-4 focus:ring-[#1B7A4A]/10 dark:focus:ring-[#25D366]/10 transition-all duration-300"
          />
        </div>
        <div>
          <label className="block text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-2 ml-1">
            Password dobara likho
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Wahi password phir se"
            autoComplete="new-password"
            required
            className="w-full px-4 py-3.5 bg-white dark:bg-[#2C2C2E] border border-black/10 dark:border-white/10 rounded-2xl text-[15px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#6E6E73] dark:placeholder:text-[#98989D] outline-none focus:border-[#1B7A4A] dark:focus:border-[#25D366] focus:ring-4 focus:ring-[#1B7A4A]/10 dark:focus:ring-[#25D366]/10 transition-all duration-300"
          />
        </div>

        {error ? (
          <p className="text-[14px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-2xl px-4 py-3">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 bg-[#1B7A4A] dark:bg-[#25D366] hover:bg-[#155F3A] dark:hover:bg-[#1DA951] active:scale-[0.98] disabled:opacity-60 text-white dark:text-[#1D1D1F] font-bold text-[15px] rounded-2xl transition-all duration-300 shadow-sm shadow-[#1B7A4A]/20"
        >
          {submitting ? 'Shop khul raha hai...' : 'Set password and enter my shop'}
        </button>
      </form>
    </div>
  )
}
