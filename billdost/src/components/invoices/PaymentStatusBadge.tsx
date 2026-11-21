'use client'

import { useTranslation } from '@/lib/i18n/useTranslation'

/**
 * The one payment-status badge for the whole app (blueprint C13):
 * list, detail, dashboard recent bills and the customer drawer all
 * render the same three states with the same words, in the shop's
 * language. Before this, a partial bill was "Partial" in the list and
 * "Unpaid" on its own detail page, and the state had four different
 * names across screens.
 */
export function PaymentStatusBadge({
  status,
  balanceDue,
}: {
  status: 'paid' | 'partial' | 'unpaid' | string
  balanceDue?: number | null
}) {
  const { t } = useTranslation()

  if (status === 'paid') {
    return (
      <span className="inline-flex items-center bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
        {t('invoices', 'paid')}
      </span>
    )
  }
  if (status === 'partial') {
    return (
      <span className="inline-flex items-center bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
        {t('invoices', 'partial')}
        {balanceDue !== null && balanceDue !== undefined && Number(balanceDue) > 0
          ? ` · ₹${Number(balanceDue).toLocaleString('en-IN')} baki`
          : ''}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
      {t('invoices', 'unpaid')}
    </span>
  )
}
