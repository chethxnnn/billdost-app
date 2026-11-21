'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Printer } from 'lucide-react'

/** Fires the browser print dialog once the receipt has rendered. */
export function AutoPrint({ invoiceId }: { invoiceId: string }) {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 350)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="no-print flex items-center justify-center gap-3 py-4">
      <button
        type="button"
        onClick={() => window.print()}
        className="tap inline-flex items-center gap-2 min-h-[48px] px-6 rounded-full bg-[#1B7A4A] hover:bg-[#155F3A] text-white font-bold text-sm transition-colors"
      >
        <Printer className="w-4 h-4" aria-hidden="true" />
        Print Karo
      </button>
      <Link
        href={`/invoices/${invoiceId}`}
        className="tap inline-flex items-center min-h-[48px] px-6 rounded-full bg-white border border-gray-200 font-bold text-sm text-gray-700"
      >
        Bill Par Wapas
      </Link>
    </div>
  )
}
