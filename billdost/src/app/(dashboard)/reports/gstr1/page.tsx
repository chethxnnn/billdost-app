'use client'

import { useMemo, useState } from 'react'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'
import { Copy, Download, Link2, ShieldOff } from 'lucide-react'
import { ErrorFallback } from '@/components/shared/ErrorFallback'

const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n)

const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const monthBounds = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` }
}

/**
 * GSTR-1 and CA pack (blueprint D9): the month's GSTR-1 sections from
 * stored bills, JSON and Tally XML downloads of the same figures,
 * and time-boxed read-only share links for the CA.
 */
export default function Gstr1Page() {
  const utils = trpc.useUtils()
  const [month, setMonth] = useState(currentMonth())
  const gstrQuery = trpc.reports.getGstr1.useQuery({ month })
  const linksQuery = trpc.reports.listShareLinks.useQuery()
  const createLinkMut = trpc.reports.createShareLink.useMutation()
  const revokeMut = trpc.reports.revokeShareLink.useMutation()

  const bounds = monthBounds(month)
  const [label, setLabel] = useState('')
  const [days, setDays] = useState(30)
  const [createdLink, setCreatedLink] = useState<string | null>(null)

  const doc: any = gstrQuery.data
  const sections = useMemo(() => {
    if (!doc) return null
    const b2bCount = (doc.b2b || []).reduce((s: number, g: any) => s + g.inv.length, 0)
    const b2bValue = (doc.b2b || []).reduce(
      (s: number, g: any) => s + g.inv.reduce((a: number, i: any) => a + i.val, 0),
      0
    )
    const b2clCount = (doc.b2cl || []).reduce((s: number, g: any) => s + g.inv.length, 0)
    const b2csTxval = (doc.b2cs || []).reduce((s: number, r: any) => s + r.txval, 0)
    const b2csTax = (doc.b2cs || []).reduce((s: number, r: any) => s + r.camt + r.samt + r.iamt, 0)
    const cdnrCount = (doc.cdnr || []).reduce((s: number, g: any) => s + g.nt.length, 0)
    const cdnurCount = (doc.cdnur || []).length
    return { b2bCount, b2bValue, b2clCount, b2csTxval, b2csTax, cdnrCount, cdnurCount }
  }, [doc])

  const handleCreateLink = async () => {
    try {
      const res = await createLinkMut.mutateAsync({
        label: label.trim() || null,
        period_from: bounds.from,
        period_to: bounds.to,
        days,
      })
      const full = `${window.location.origin}${res.path}`
      setCreatedLink(full)
      setLabel('')
      void utils.reports.listShareLinks.invalidate()
      toast.success('CA link ban gaya. Link abhi copy kar lo, dobara nahi dikhega.')
    } catch (err: any) {
      toast.error(err.message || 'Link nahi ban paya.')
    }
  }

  const handleRevoke = async (id: string) => {
    try {
      await revokeMut.mutateAsync({ id })
      toast.success('Link band kar diya.')
      void utils.reports.listShareLinks.invalidate()
    } catch (err: any) {
      toast.error(err.message || 'Link band nahi ho paya.')
    }
  }

  if (gstrQuery.error) {
    return (
      <ErrorFallback
        error={new Error(gstrQuery.error.message)}
        onRetry={() => void gstrQuery.refetch()}
        variant="inline"
      />
    )
  }

  return (
    <div className="w-full max-w-[1100px] mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">GSTR-1</h1>
          <p className="text-gray-500 dark:text-[#98989D] mt-1 text-[15px]">
            Mahine ki poori GST report, CA ke liye JSON, Tally XML aur share link.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
          Mahina
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value || currentMonth())}
            aria-label="Mahina chuno"
            className="min-h-[48px] px-3 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm outline-none focus:border-[#1B7A4A]"
          />
        </label>
      </div>

      {gstrQuery.isLoading ? (
        <div className="space-y-2" aria-busy="true">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-100 dark:bg-[#2C2C2E] rounded-3xl h-24 w-full" />
          ))}
        </div>
      ) : sections ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] rounded-3xl p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">B2B Bills</p>
              <p className="text-2xl font-extrabold mt-1 text-gray-900 dark:text-white">{sections.b2bCount}</p>
              <p className="text-xs text-gray-500 mt-1">{formatINR(sections.b2bValue)}</p>
            </div>
            <div className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] rounded-3xl p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">B2CL (Bade Interstate)</p>
              <p className="text-2xl font-extrabold mt-1 text-gray-900 dark:text-white">{sections.b2clCount}</p>
              <p className="text-xs text-gray-500 mt-1">Rs 1,00,000 se upar, bina GSTIN</p>
            </div>
            <div className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] rounded-3xl p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">B2CS Taxable</p>
              <p className="text-2xl font-extrabold mt-1 text-gray-900 dark:text-white">{formatINR(sections.b2csTxval)}</p>
              <p className="text-xs text-gray-500 mt-1">Tax {formatINR(sections.b2csTax)}</p>
            </div>
            <div className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] rounded-3xl p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Credit Notes</p>
              <p className="text-2xl font-extrabold mt-1 text-gray-900 dark:text-white">
                {sections.cdnrCount + sections.cdnurCount}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                CDNR {sections.cdnrCount} · CDNUR {sections.cdnurCount}
              </p>
            </div>
          </div>

          <p className="text-sm text-gray-500">
            Kul {doc.meta.invoice_count} bills is report me hain.
            {doc.meta.cancelled_excluded > 0 &&
              ` ${doc.meta.cancelled_excluded} cancelled bills shamil nahi hain.`}{' '}
            HSN summary rows: {(doc.hsn?.data || []).length}
          </p>

          {(doc.meta.warnings || []).length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 rounded-2xl px-4 py-3 space-y-1">
              <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Dhyaan do</p>
              {(doc.meta.warnings as string[]).map((w, i) => (
                <p key={i} className="text-sm text-amber-700 dark:text-amber-400">{w}</p>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/exports/gstr1?month=${month}`}
              className="tap inline-flex items-center gap-2 min-h-[52px] px-5 rounded-2xl bg-[#1B7A4A] hover:bg-[#155F3A] text-white font-bold transition-colors"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              GSTR-1 JSON Download
            </a>
            <a
              href={`/api/exports/tally?month=${month}`}
              className="tap inline-flex items-center gap-2 min-h-[52px] px-5 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] font-bold"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              Tally XML Download
            </a>
          </div>
        </>
      ) : null}

      {/* CA share links */}
      <div className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] rounded-3xl p-5 space-y-4">
        <div>
          <h2 className="font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <Link2 className="w-4 h-4" aria-hidden="true" /> CA Ke Liye Share Link
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Link kholne par CA bina login ke sirf is mahine ({bounds.from} se {bounds.to}) ka GST
            summary dekh sakega. Kuch edit nahi ho sakta.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (jaise: CA Sharma ji)"
            aria-label="Link label"
            className="flex-1 min-w-[180px] min-h-[48px] px-3 bg-gray-50 dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm outline-none focus:border-[#1B7A4A]"
          />
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            aria-label="Link kitne din chalega"
            className="min-h-[48px] px-3 bg-gray-50 dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] rounded-xl text-sm outline-none focus:border-[#1B7A4A]"
          >
            <option value={7}>7 din</option>
            <option value={30}>30 din</option>
            <option value={90}>90 din</option>
          </select>
          <button
            type="button"
            onClick={() => void handleCreateLink()}
            disabled={createLinkMut.isPending}
            className="tap min-h-[48px] px-5 rounded-xl bg-[#1B7A4A] hover:bg-[#155F3A] disabled:opacity-50 text-white font-bold text-sm transition-colors"
          >
            Link Banao
          </button>
        </div>

        {createdLink && (
          <div className="flex flex-wrap items-center gap-2 bg-[#1B7A4A]/10 border border-[#1B7A4A]/20 rounded-2xl px-4 py-3">
            <code className="text-sm font-mono break-all flex-1 text-gray-900 dark:text-white">{createdLink}</code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(createdLink)
                toast.success('Link copy ho gaya.')
              }}
              className="tap inline-flex items-center gap-1 min-h-[44px] px-3 rounded-full bg-[#1B7A4A] text-white text-sm font-bold"
            >
              <Copy className="w-4 h-4" aria-hidden="true" /> Copy
            </button>
            <p className="w-full text-xs text-gray-500">
              Ye link sirf ek baar dikh raha hai. Database me iska hash rakha hai, link dobara nahi
              niklega; naya chahiye to naya banao.
            </p>
          </div>
        )}

        {(linksQuery.data || []).length > 0 && (
          <ul className="divide-y divide-gray-100 dark:divide-[#38383A]">
            {(linksQuery.data || []).map((link: any) => (
              <li key={link.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="font-semibold truncate block">{link.label || 'CA Link'}</span>
                  <span className="text-xs text-gray-500">
                    {link.period_from} se {link.period_to} ·{' '}
                    {link.state === 'active'
                      ? `chal raha hai, ${new Date(link.expires_at).toLocaleDateString('en-IN')} tak`
                      : link.state === 'revoked'
                        ? 'band kar diya'
                        : 'time khatm'}
                  </span>
                </span>
                {link.state === 'active' && (
                  <button
                    type="button"
                    onClick={() => void handleRevoke(link.id)}
                    disabled={revokeMut.isPending}
                    className="tap inline-flex items-center gap-1 min-h-[44px] px-3 rounded-full border border-gray-200 dark:border-[#38383A] font-bold text-xs disabled:opacity-40"
                  >
                    <ShieldOff className="w-3.5 h-3.5" aria-hidden="true" /> Band Karo
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
