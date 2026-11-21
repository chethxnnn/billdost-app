'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (password.length < 6) {
      setError('Password kam se kam 6 characters ka hona chahiye')
      setLoading(false)
      return
    }

    const supabase = createClient()

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          phone: phone ? `+91${phone.replace(/\D/g, '').slice(-10)}` : undefined,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (authError) {
      if (authError.message.includes('already registered')) {
        setError('Ye email pehle se registered hai. Login try karo.')
      } else {
        setError(authError.message)
      }
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  // Success state: check your email
  if (success) {
    return (
      <div className="w-full animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-white/70 dark:bg-[#1C1C1E]/70 backdrop-blur-2xl border border-black/5 dark:border-white/5 rounded-[32px] p-8 md:p-10 shadow-2xl shadow-black/5 dark:shadow-black/20 text-center">
          <div className="w-20 h-20 bg-[#1B7A4A]/10 dark:bg-[#25D366]/10 rounded-[24px] flex items-center justify-center mx-auto mb-6 text-4xl shadow-sm shadow-[#1B7A4A]/5">
            📧
          </div>
          <h1
            className="text-[28px] font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight mb-3"
            style={{ fontFamily: 'var(--font-display, "Syne", sans-serif)' }}
          >
            Check your email
          </h1>
          <p className="text-[15px] text-[#6E6E73] dark:text-[#98989D] mb-8 font-medium max-w-sm mx-auto leading-relaxed">
            We've sent a verification link to <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{email}</strong>. Click the link to complete your setup.
          </p>
          
          <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-5 text-left mb-8">
            <p className="text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-3">Didn't receive the email?</p>
            <ul className="text-[13px] text-[#6E6E73] dark:text-[#98989D] space-y-2 font-medium">
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#6E6E73] dark:bg-[#98989D]" /> Check your Spam or Junk folder</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#6E6E73] dark:bg-[#98989D]" /> Check the Promotions tab in Gmail</li>
              <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#6E6E73] dark:bg-[#98989D]" /> Verify that your email address is correct</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setSuccess(false)}
              className="flex-1 py-4 bg-transparent border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.98] text-[#1D1D1F] dark:text-[#F5F5F7] font-semibold rounded-2xl text-[15px] transition-all duration-300"
            >
              Go back
            </button>
            <Link
              href="/login"
              className="flex-1 py-4 bg-[#1B7A4A] dark:bg-[#25D366] hover:bg-[#155F3A] dark:hover:bg-[#1DA951] active:scale-[0.98] text-white dark:text-[#1D1D1F] font-bold text-[15px] rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm shadow-[#1B7A4A]/20"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="text-center mb-10">
        <h1
          className="text-[32px] md:text-[40px] font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight leading-tight mb-3"
          style={{ fontFamily: 'var(--font-display, "Syne", sans-serif)' }}
        >
          Create account
        </h1>
        <p className="text-[15px] text-[#6E6E73] dark:text-[#98989D] font-medium flex items-center justify-center gap-1">
          Start your free <span className="font-display font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">Bill<span className="text-[#1B7A4A] dark:text-[#25D366]">Dost</span></span> account today
        </p>
      </div>

      {/* Form Container */}
      <div className="bg-white/70 dark:bg-[#1C1C1E]/70 backdrop-blur-2xl border border-black/5 dark:border-white/5 rounded-[32px] p-6 md:p-8 shadow-2xl shadow-black/5 dark:shadow-black/20 transition-all duration-300">
        <form onSubmit={handleSignup} className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-2 ml-1">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Suresh Sharma"
              required
              className="w-full px-4 py-3.5 bg-white dark:bg-[#2C2C2E] border border-black/10 dark:border-white/10 rounded-2xl text-[15px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#6E6E73] dark:placeholder:text-[#98989D] outline-none focus:border-[#1B7A4A] dark:focus:border-[#25D366] focus:ring-4 focus:ring-[#1B7A4A]/10 dark:focus:ring-[#25D366]/10 transition-all duration-300"
            />
          </div>

          {/* Phone (optional) */}
          <div>
            <div className="flex items-center justify-between mb-2 mx-1">
              <label className="block text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                WhatsApp Number
              </label>
              <span className="text-[12px] font-medium text-[#6E6E73] dark:text-[#98989D]">Optional</span>
            </div>
            <div className="flex group">
              <span className="flex items-center justify-center px-4 bg-white dark:bg-[#2C2C2E] border border-r-0 border-black/10 dark:border-white/10 rounded-l-2xl text-[15px] font-medium text-[#6E6E73] dark:text-[#98989D] group-focus-within:border-[#1B7A4A] dark:group-focus-within:border-[#25D366] transition-colors duration-300">
                +91
              </span>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="98765 43210"
                className="w-full px-4 py-3.5 bg-white dark:bg-[#2C2C2E] border border-l-0 border-black/10 dark:border-white/10 rounded-r-2xl text-[15px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#6E6E73] dark:placeholder:text-[#98989D] outline-none group-focus-within:border-[#1B7A4A] dark:group-focus-within:border-[#25D366] group-focus-within:ring-4 group-focus-within:ring-[#1B7A4A]/10 dark:group-focus-within:ring-[#25D366]/10 transition-all duration-300"
              />
            </div>
          </div>

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
            <label className="block text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-2 ml-1">
              Create Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
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
                <span>Creating account...</span>
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Terms */}
        <p className="text-[12px] text-[#6E6E73] dark:text-[#98989D] font-medium mt-6 text-center leading-relaxed">
          By signing up, you agree to our{' '}
          <Link href="/terms" className="text-[#1D1D1F] dark:text-[#F5F5F7] hover:underline underline-offset-2">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-[#1D1D1F] dark:text-[#F5F5F7] hover:underline underline-offset-2">
            Privacy Policy
          </Link>.
        </p>
      </div>

      {/* Login link */}
      <p className="text-center text-[15px] font-medium text-[#6E6E73] dark:text-[#98989D] mt-8">
        Already have an account?{' '}
        <Link
          href="/login"
          className="text-[#1B7A4A] dark:text-[#25D366] font-bold hover:underline underline-offset-4"
        >
          Sign in
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
