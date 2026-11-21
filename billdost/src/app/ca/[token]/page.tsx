import { createHash } from 'crypto'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { fetchGstRangeData } from '@/server/gstr1Data'

/**
 * Public CA share page (blueprint D9): /ca/<token>
 *
 * Read-only GST summary for the shop's CA, with no login. The raw
 * token exists only in this URL; the database stores its sha256
 * hash. The token is validated first (exists, not revoked, not
 * expired), and only then is the shop's data read with the service
 * role, limited to the link's own period. Nothing here can write.
 */

export const dynamic = 'force-dynamic'

const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n)

function MessagePage({ title, body }: { title: string; body: string }) {
  return (
    <main className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl border border-gray-100 p-8 text-center shadow-sm">
        <h1 className="text-xl font-extrabold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500 mt-2">{body}</p>
      </div>
    </main>
  )
}

export default async function CaSharePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const tokenHash = createHash('sha256').update(token).digest('hex')

  const service = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: link } = await service
    .from('ca_share_links')
    .select('id, shop_id, label, period_from, period_to, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .single()

  if (!link) {
    return (
      <MessagePage
        title="Link nahi mila"
        body="Ye link galat hai ya band kar diya gaya hai. Dukaan se naya link mangiye."
      />
    )
  }
  if (link.revoked_at) {
    return (
      <MessagePage
        title="Link band hai"
        body="Dukaan ne ye link band kar diya hai. Naya link mangiye."
      />
    )
  }
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
    return (
      <MessagePage
        title="Link ka time khatm"
        body="Is link ki validity khatm ho gayi hai. Dukaan se naya link mangiye."
      />
    )
  }

  const { data: shop } = await service
    .from('shops')
    .select('name, gstin')
    .eq('id', link.shop_id)
    .single()
  if (!shop) {
    return <MessagePage title="Dukaan nahi mili" body="Kuch gadbad hai. Dukaan se sampark karo." />
  }

  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const from = link.period_from || monthStart
  const to = link.period_to || now.toISOString().split('T')[0]

  const data = await fetchGstRangeData(service, link.shop_id, from, to)
  const active = data.tallyInvoices.filter((i) => i.status !== 'cancelled')
  const totals = active.reduce(
    (acc, inv) => ({
      taxable: acc.taxable + inv.taxable_amt,
      cgst: acc.cgst + inv.cgst_amt,
      sgst: acc.sgst + inv.sgst_amt,
      igst: acc.igst + inv.igst_amt,
      total: acc.total + inv.total,
    }),
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 }
  )
  const creditTotal = data.creditNotes.reduce((s, n) => s + n.total, 0)
  const creditTaxable = data.creditNotes.reduce((s, n) => s + n.taxable_amt, 0)

  const rows: Array<[string, string]> = [
    ['Taxable Value', formatINR(totals.taxable)],
    ['CGST', formatINR(totals.cgst)],
    ['SGST', formatINR(totals.sgst)],
    ['IGST', formatINR(totals.igst)],
    ['Kul Bill Value', formatINR(totals.total)],
    ['Credit Notes (Taxable)', formatINR(creditTaxable)],
    ['Credit Notes (Kul)', formatINR(creditTotal)],
  ]

  return (
    <main className="min-h-screen bg-[#F5F5F7] p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
            GST Summary (Read Only)
          </p>
          <h1 className="text-2xl font-extrabold text-gray-900 mt-1">{shop.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {shop.gstin ? `GSTIN: ${shop.gstin} · ` : ''}
            Period: {from} se {to}
            {link.label ? ` · ${link.label}` : ''}
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
          <table className="w-full text-sm">
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label} className="border-b border-gray-50 last:border-0">
                  <td className="py-2.5 text-gray-500 font-medium">{label}</td>
                  <td className="py-2.5 text-right font-extrabold text-gray-900">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-400 mt-4">
            Kul {active.length} bills aur {data.creditNotes.length} credit notes is period ke hain.
            Ye page sirf dekhne ke liye hai; isse kuch badla nahi ja sakta.
            {link.expires_at &&
              ` Link ${new Date(link.expires_at).toLocaleDateString('en-IN')} tak chalega.`}
          </p>
        </div>

        <p className="text-center text-xs text-gray-400">BillDost par banaya gaya surakshit CA share page</p>
      </div>
    </main>
  )
}
