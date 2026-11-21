'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Copy, Home, RotateCcw, ShieldCheck } from 'lucide-react'
import { readActivitySnapshot, type ActivitySnapshot } from '@/lib/activity-snapshot'
import { APP_VERSION } from '@/lib/version'

interface Props {
  error?: (Error & { digest?: string }) | null
  onRetry?: () => void
  /** 'page' fills the screen (route error boundaries); 'inline' sits inside a page (failed query). */
  variant?: 'page' | 'inline'
  homeHref?: string
}

const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

/**
 * The one error surface for the whole app (design brief error-state
 * rule): never a raw error or a dead screen. Reassure first, show the
 * user their own work is intact second, technical detail last and
 * hidden behind the support expander.
 */
export function ErrorFallback({ error, onRetry, variant = 'page', homeHref = '/dashboard' }: Props) {
  const [snapshot, setSnapshot] = useState<ActivitySnapshot | null>(null)
  const [route, setRoute] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setSnapshot(readActivitySnapshot())
    setRoute(window.location.pathname)
    if (error) {
      // Logged with the digest so a beta issue is traceable from the
      // console or a future error-log endpoint without asking the user.
      console.error('[BillDost error]', { digest: error.digest, name: error.name, message: error.message })

      // Post the digest to the client error log (the future Admin
      // Portal issue centre feed). Fire-and-forget with keepalive: it
      // must never block or break the fallback UI itself.
      try {
        void fetch('/api/client-errors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          body: JSON.stringify({
            route: window.location.pathname,
            digest: error.digest ?? null,
            name: error.name,
            message: error.message,
            version: APP_VERSION,
          }),
        }).catch(() => {})
      } catch {
        // Telemetry is best-effort only.
      }
    }
  }, [error])

  const detailsText = [
    `Error: ${error?.name || 'UnknownError'}`,
    `Message: ${error?.message || 'No message'}`,
    `Digest: ${error?.digest || 'none'}`,
    `Route: ${route || 'unknown'}`,
    `Time: ${new Date().toISOString()}`,
    `App version: ${APP_VERSION}`,
  ].join('\n')

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(detailsText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable: the details are visible to copy manually.
    }
  }

  const isPage = variant === 'page'

  return (
    <div
      className={
        isPage
          ? 'min-h-[70vh] flex items-center justify-center px-4 py-10'
          : 'flex items-center justify-center px-4 py-10'
      }
    >
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-6 w-14 h-14 rounded-full bg-[#1B7A4A]/10 dark:bg-[#25D366]/10 flex items-center justify-center">
          <ShieldCheck className="w-7 h-7 text-[#1B7A4A] dark:text-[#25D366]" aria-hidden="true" />
        </div>

        <h1
          className={`font-display font-extrabold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7] ${
            isPage ? 'text-4xl sm:text-5xl' : 'text-3xl'
          }`}
        >
          We&rsquo;ll be back
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#6E6E73] dark:text-[#98989D]">
          Kuch technical gadbad ho gayi hai, hum use theek kar rahe hain.
          Ghabraiye mat, aapka saara data bilkul safe hai.
        </p>

        {/* Personalized recap: the user's own work, intact */}
        <div className="mt-6 text-left bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/10 rounded-3xl p-5 ios-shadow">
          <h2 className="text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7] mb-2">Aapka kaam safe hai</h2>
          {snapshot && (snapshot.todayBills !== undefined || snapshot.lastInvoiceNumber || snapshot.shopName) ? (
            <ul className="space-y-1.5 text-sm text-[#6E6E73] dark:text-[#98989D]">
              {snapshot.shopName && (
                <li>
                  Shop: <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{snapshot.shopName}</span>
                </li>
              )}
              {snapshot.todayBills !== undefined && (
                <li>
                  Aaj ke bills:{' '}
                  <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {snapshot.todayBills}
                    {snapshot.todayTotal !== undefined ? ` · ${formatINR(snapshot.todayTotal)}` : ''}
                  </span>
                </li>
              )}
              {snapshot.lastInvoiceNumber && (
                <li>
                  Aakhri bill:{' '}
                  <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {snapshot.lastInvoiceNumber}
                    {snapshot.lastCustomerName ? ` · ${snapshot.lastCustomerName}` : ''}
                  </span>
                </li>
              )}
            </ul>
          ) : (
            <p className="text-sm text-[#6E6E73] dark:text-[#98989D]">
              Jo bills, customers aur data aapne banaya hai, woh bilkul safe hai. Kuch bhi delete nahi hua hai.
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="tap inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-full bg-[#1B7A4A] hover:bg-[#155F3A] text-white font-bold text-[15px] transition-colors"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              Dobara Try Karo
            </button>
          )}
          <Link
            href={homeHref}
            className="tap inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-full bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 font-bold text-[15px] text-[#1D1D1F] dark:text-[#F5F5F7] transition-colors"
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            Dashboard Jao
          </Link>
        </div>

        {/* Technical detail: last, hidden, copyable for support */}
        <details className="mt-8 text-left">
          <summary className="cursor-pointer text-[13px] font-semibold text-[#6E6E73] dark:text-[#98989D] min-h-[44px] flex items-center">
            Details for support
          </summary>
          <div className="mt-2 bg-black/5 dark:bg-white/5 rounded-2xl p-4">
            <pre className="text-[12px] leading-relaxed whitespace-pre-wrap break-all text-[#1D1D1F] dark:text-[#F5F5F7]">
              {detailsText}
            </pre>
            <button
              type="button"
              onClick={handleCopy}
              className="tap mt-3 inline-flex items-center gap-2 min-h-[44px] px-4 rounded-full bg-white dark:bg-[#2C2C2E] border border-black/10 dark:border-white/10 text-[13px] font-bold"
            >
              {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy details'}
            </button>
          </div>
        </details>
      </div>
    </div>
  )
}
