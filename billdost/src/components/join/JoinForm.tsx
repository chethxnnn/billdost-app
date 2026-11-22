'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { staffJoinState, type StaffJoinState } from '@/lib/staff-invite'

/**
 * The staff join page (Stage 4). The mirror of shop activation for
 * team members: the link names the shop and the role up front, the
 * invitee sets their own password, and they walk straight into the
 * shop. When the invited email already has a BillDost account, the
 * page offers the sign-in path instead (accept_staff_invite attaches
 * the membership on login). Every dead-link state is a calm page,
 * never an error code.
 */
type Phase = 'checking' | 'account' | StaffJoinState

const ROLE_LABELS: Record<string, string> = {
  manager: 'Manager',
  cashier: 'Cashier',
}

export default function JoinForm({ token }: { token: string }) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('checking')
  const [shopName, setShopName] = useState('')
  const [staffName, setStaffName] = useState('')
  const [role, setRole] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [hasEmail, setHasEmail] = useState(true)
  const [supportPhone, setSupportPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/join/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = await res.json()
        if (cancelled) return
        setSupportPhone(data.support_phone ?? '')
        const state = staffJoinState(data.state)
        if (state === 'valid') {
          setShopName(data.shop_name ?? '')
          setStaffName(data.staff_name ?? '')
          setRole(data.role ?? '')
          setInviteEmail(data.email ?? '')
          setHasEmail(Boolean(data.has_email))
          setPhase(data.account_exists ? 'account' : 'valid')
        } else {
          setPhase(state)
        }
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
    if (!hasEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Sahi email likho, yahi aapka login hoga.')
      return
    }
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
      const res = await fetch('/api/join/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password,
          email: hasEmail ? undefined : email.trim(),
        }),
      })
      const data = await res.json()
      if (!data.ok) {
        if (data.state === 'weak_password') {
          setError('Password kam se kam 8 characters ka hona chahiye.')
          setSubmitting(false)
          return
        }
        if (data.state === 'email_required') {
          setError('Sahi email likho, yahi aapka login hoga.')
          setSubmitting(false)
          return
        }
        if (data.state === 'account_exists') {
          setPhase('account')
          setSubmitting(false)
          return
        }
        setPhase(staffJoinState(data.state))
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

  const inputClass =
    'w-full px-4 py-3.5 bg-white dark:bg-[#2C2C2E] border border-black/10 dark:border-white/10 rounded-2xl text-[15px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#6E6E73] dark:placeholder:text-[#98989D] outline-none focus:border-[#1B7A4A] dark:focus:border-[#25D366] focus:ring-4 focus:ring-[#1B7A4A]/10 dark:focus:ring-[#25D366]/10 transition-all duration-300'

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
          {showLogin ? (
            <Link
              href="/login"
              className="w-full py-4 bg-[#1B7A4A] dark:bg-[#25D366] hover:bg-[#155F3A] dark:hover:bg-[#1DA951] active:scale-[0.98] text-white dark:text-[#1D1D1F] font-bold text-[15px] rounded-2xl transition-all duration-300 text-center"
            >
              Go to login
            </Link>
          ) : null}
          {supportPhone ? (
            <a
              href={`tel:${supportPhone.replace(/\s/g, '')}`}
              className="w-full py-4 bg-transparent border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.98] text-[#1D1D1F] dark:text-[#F5F5F7] font-semibold rounded-2xl text-[15px] transition-all duration-300"
            >
              Call us: {supportPhone}
            </a>
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
      'Shop owner se kaho, woh ek fresh link bhej denge. Ek minute lagega.'
    )
  }
  if (phase === 'replaced') {
    return deadLink(
      'A newer link is on its way',
      'Ye link ek naye link se badal gaya hai. Owner ka bheja sabse naya link use karo.'
    )
  }
  if (phase === 'used') {
    return deadLink(
      'You have already joined',
      'Aap is shop ki team mein shamil ho chuke ho. Bas apne password se login karo.',
      true
    )
  }

  if (phase === 'account') {
    return (
      <div className={card + ' text-center'}>
        <div className="w-20 h-20 bg-[#1B7A4A]/10 dark:bg-[#25D366]/10 rounded-[24px] flex items-center justify-center mx-auto mb-6 text-4xl">
          👋
        </div>
        <h1 className="text-[26px] font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight mb-3">
          {shopName ? `${shopName} mein swagat hai` : 'Swagat hai'}
        </h1>
        <p className="text-[15px] text-[#6E6E73] dark:text-[#98989D] font-medium leading-relaxed mb-8">
          {staffName ? `Namaste ${staffName}. ` : 'Namaste. '}
          Is email par aapka BillDost account pehle se hai. Sign in karte
          hi {shopName || 'shop'} ki membership apne aap jud jayegi.
        </p>
        <Link
          href="/login"
          className="block w-full py-4 bg-[#1B7A4A] dark:bg-[#25D366] hover:bg-[#155F3A] dark:hover:bg-[#1DA951] active:scale-[0.98] text-white dark:text-[#1D1D1F] font-bold text-[15px] rounded-2xl transition-all duration-300 text-center"
        >
          Sign in karke join karo
        </Link>
      </div>
    )
  }

  const roleLabel = ROLE_LABELS[role] ?? role

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
          {staffName ? `Namaste ${staffName}. ` : 'Namaste. '}
          Aapko is shop mein {roleLabel} ke roop mein bulaya gaya hai.
          Apna password set karo aur team mein shamil ho jao.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {hasEmail ? (
          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-2 ml-1">
              Aapka login email
            </label>
            <div className="w-full px-4 py-3.5 bg-black/[0.03] dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-2xl text-[15px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
              {inviteEmail}
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-2 ml-1">
              Apna email likho (yahi login hoga)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rahul@example.com"
              autoComplete="email"
              required
              className={inputClass}
            />
          </div>
        )}
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
            className={inputClass}
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
            className={inputClass}
          />
        </div>
        {error ? (
          <p className="text-[13px] font-medium text-red-600 dark:text-red-400 ml-1">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 bg-[#1B7A4A] dark:bg-[#25D366] hover:bg-[#155F3A] dark:hover:bg-[#1DA951] active:scale-[0.98] text-white dark:text-[#1D1D1F] font-bold text-[15px] rounded-2xl transition-all duration-300 disabled:opacity-50"
        >
          {submitting ? 'Ek minute...' : 'Password set karke join karo'}
        </button>
      </form>
    </div>
  )
}
