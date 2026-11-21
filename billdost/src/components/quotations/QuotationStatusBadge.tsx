/**
 * The one quotation-status badge (blueprint C13): before Stage 3 the
 * status was visible only as a small pill on the list, and the detail
 * page showed nothing except a Converted pill, so draft, sent,
 * accepted and rejected were indistinguishable where it matters.
 */
const STYLES: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-[#98989D]' },
  sent: { label: 'Bheja Hua', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400' },
  accepted: { label: 'Accepted', cls: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400' },
  expired: { label: 'Expired', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400' },
  converted: { label: 'Bill Ban Gaya', cls: 'bg-green-600 text-white dark:bg-green-500 dark:text-black' },
}

export function QuotationStatusBadge({ status }: { status: string }) {
  const s = STYLES[status] ?? { label: status, cls: STYLES.draft.cls }
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${s.cls}`}>
      {s.label}
    </span>
  )
}
