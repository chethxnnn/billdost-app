'use client'

import { useEffect, useState } from 'react'

/**
 * Last-resort boundary: replaces the root layout itself, so it cannot
 * rely on globals.css or any provider. Fully self-contained with
 * inline styles, following the same error-state rule: reassure first,
 * the user's work is safe, technical detail last and hidden.
 */
export default function GlobalError({
  error,
  unstable_retry,
  reset,
}: {
  error: Error & { digest?: string }
  unstable_retry?: () => void
  reset?: () => void
}) {
  const [recap, setRecap] = useState<string | null>(null)

  useEffect(() => {
    console.error('[BillDost error]', { digest: error?.digest, name: error?.name, message: error?.message })
    try {
      const raw = localStorage.getItem('billdost-activity-snapshot')
      if (raw) {
        const snap = JSON.parse(raw)
        const parts: string[] = []
        if (snap.shopName) parts.push(`Shop: ${snap.shopName}`)
        if (typeof snap.todayBills === 'number') parts.push(`Aaj ke bills: ${snap.todayBills}`)
        if (snap.lastInvoiceNumber) parts.push(`Aakhri bill: ${snap.lastInvoiceNumber}`)
        if (parts.length) setRecap(parts.join(' · '))
      }
    } catch {
      // Snapshot is a nicety, never a requirement.
    }
  }, [error])

  const retry = unstable_retry ?? reset ?? (() => window.location.reload())
  const details = [
    `Error: ${error?.name || 'UnknownError'}`,
    `Message: ${error?.message || 'No message'}`,
    `Digest: ${error?.digest || 'none'}`,
    `Time: ${new Date().toISOString()}`,
  ].join('\n')

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F5F5F7',
          color: '#1D1D1F',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          padding: '24px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <h1 style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 12px' }}>
            We&rsquo;ll be back
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: '#6E6E73', margin: '0 0 20px' }}>
            Kuch technical gadbad ho gayi hai, hum use theek kar rahe hain.
            Ghabraiye mat, aapka saara data bilkul safe hai.
          </p>
          {recap && (
            <p
              style={{
                fontSize: 14,
                backgroundColor: '#FFFFFF',
                border: '1px solid rgba(0,0,0,0.06)',
                borderRadius: 16,
                padding: '12px 16px',
                margin: '0 0 20px',
              }}
            >
              Aapka kaam safe hai · {recap}
            </p>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={retry}
              style={{
                minHeight: 48,
                padding: '0 24px',
                borderRadius: 999,
                border: 'none',
                backgroundColor: '#1B7A4A',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: 15,
                cursor: 'pointer',
              }}
            >
              Dobara Try Karo
            </button>
            <a
              href="/dashboard"
              style={{
                minHeight: 48,
                padding: '0 24px',
                borderRadius: 999,
                border: '1px solid rgba(0,0,0,0.12)',
                backgroundColor: '#FFFFFF',
                color: '#1D1D1F',
                fontWeight: 700,
                fontSize: 15,
                display: 'inline-flex',
                alignItems: 'center',
                textDecoration: 'none',
                boxSizing: 'border-box',
              }}
            >
              Dashboard Jao
            </a>
          </div>
          <details style={{ marginTop: 28, textAlign: 'left' }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#6E6E73' }}>
              Details for support
            </summary>
            <pre
              style={{
                marginTop: 8,
                backgroundColor: 'rgba(0,0,0,0.05)',
                borderRadius: 12,
                padding: 14,
                fontSize: 12,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {details}
            </pre>
          </details>
        </div>
      </body>
    </html>
  )
}
