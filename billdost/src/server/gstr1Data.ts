import type {
  Gstr1CreditNoteInput,
  Gstr1InvoiceInput,
} from '@/lib/gstr1'
import type { TallyInvoiceInput } from '@/lib/tally'

/**
 * Shared fetch for the GST exports (blueprint D9): one read of the
 * stored invoices, items and credit notes for a date range, shaped
 * for both the GSTR-1 builder and the Tally builder so every surface
 * (reports page, JSON download, Tally download, CA share page) shows
 * the same figures from the same stored rows.
 *
 * Works with any supabase client: the caller's RLS client for
 * in-app surfaces, or the service role for the token-gated CA page
 * (which validates the share token before calling this).
 */

export interface GstRangeData {
  gstr1Invoices: Gstr1InvoiceInput[]
  creditNotes: Gstr1CreditNoteInput[]
  tallyInvoices: TallyInvoiceInput[]
}

const STANDARD_RATES = [0, 0.1, 0.25, 1, 1.5, 3, 5, 12, 18, 28]

/** Snap a weighted-average rate to the nearest standard GST rate. */
function snapRate(rate: number): number {
  let best = STANDARD_RATES[0]
  for (const r of STANDARD_RATES) {
    if (Math.abs(r - rate) < Math.abs(best - rate)) best = r
  }
  return Math.abs(best - rate) <= 0.05 ? best : Math.round(rate * 100) / 100
}

export async function fetchGstRangeData(
  supabase: any,
  shopId: string,
  from: string, // YYYY-MM-DD
  to: string // YYYY-MM-DD
): Promise<GstRangeData> {
  const { data: invoices, error: invErr } = await supabase
    .from('invoices')
    .select(
      'id, invoice_number, invoice_date, customer_name, customer_gstin, place_of_supply_state_code, is_interstate, total, taxable_amt, cgst_amt, sgst_amt, igst_amt, status'
    )
    .eq('shop_id', shopId)
    .gte('invoice_date', from)
    .lte('invoice_date', to)
    .order('invoice_date', { ascending: true })
  if (invErr) throw new Error(invErr.message)

  const invoiceRows = invoices || []
  const invoiceIds = invoiceRows.map((i: any) => i.id)

  let itemsByInvoice = new Map<string, any[]>()
  if (invoiceIds.length > 0) {
    const { data: items, error: itemsErr } = await supabase
      .from('invoice_items')
      .select('invoice_id, name, hsn_code, quantity, unit, unit_price, tax_rate, taxable_amt, tax_amt, sort_order')
      .in('invoice_id', invoiceIds)
      .order('sort_order', { ascending: true })
    if (itemsErr) throw new Error(itemsErr.message)
    for (const item of items || []) {
      const list = itemsByInvoice.get(item.invoice_id) || []
      list.push(item)
      itemsByInvoice.set(item.invoice_id, list)
    }
  }

  const gstr1Invoices: Gstr1InvoiceInput[] = invoiceRows.map((inv: any) => ({
    invoice_number: inv.invoice_number,
    invoice_date: inv.invoice_date,
    customer_name: inv.customer_name,
    customer_gstin: inv.customer_gstin || null,
    place_of_supply_state_code: inv.place_of_supply_state_code || null,
    is_interstate: Boolean(inv.is_interstate),
    total: Number(inv.total) || 0,
    status: inv.status,
    lines: (itemsByInvoice.get(inv.id) || []).map((it: any) => ({
      hsn_code: it.hsn_code || null,
      tax_rate: Number(it.tax_rate) || 0,
      taxable_amt: Number(it.taxable_amt) || 0,
      tax_amt: Number(it.tax_amt) || 0,
      quantity: Number(it.quantity) || 0,
      unit: it.unit || 'piece',
    })),
  }))

  const tallyInvoices: TallyInvoiceInput[] = invoiceRows.map((inv: any) => ({
    invoice_number: inv.invoice_number,
    invoice_date: inv.invoice_date,
    customer_name: inv.customer_name,
    customer_gstin: inv.customer_gstin || null,
    status: inv.status,
    taxable_amt: Number(inv.taxable_amt) || 0,
    cgst_amt: Number(inv.cgst_amt) || 0,
    sgst_amt: Number(inv.sgst_amt) || 0,
    igst_amt: Number(inv.igst_amt) || 0,
    total: Number(inv.total) || 0,
    lines: (itemsByInvoice.get(inv.id) || []).map((it: any) => ({
      name: it.name,
      hsn_code: it.hsn_code || null,
      quantity: Number(it.quantity) || 0,
      unit: it.unit || 'piece',
      unit_price: Number(it.unit_price) || 0,
      taxable_amt: Number(it.taxable_amt) || 0,
      tax_amt: Number(it.tax_amt) || 0,
      tax_rate: Number(it.tax_rate) || 0,
    })),
  }))

  // Credit notes in range (note date is the row's created_at date).
  const { data: notes, error: notesErr } = await supabase
    .from('credit_notes')
    .select('id, invoice_id, note_number, reason, subtotal, tax_amt, total, created_at')
    .eq('shop_id', shopId)
    .gte('created_at', `${from}T00:00:00`)
    .lte('created_at', `${to}T23:59:59`)
    .order('created_at', { ascending: true })
  if (notesErr) throw new Error(notesErr.message)

  const creditNotes: Gstr1CreditNoteInput[] = []
  for (const note of notes || []) {
    const original = invoiceRows.find((i: any) => i.id === note.invoice_id)
    let origInvoice: any = original
    if (!origInvoice) {
      const { data } = await supabase
        .from('invoices')
        .select('id, invoice_number, customer_gstin, place_of_supply_state_code, is_interstate')
        .eq('id', note.invoice_id)
        .single()
      origInvoice = data
    }
    if (!origInvoice) continue

    // Weighted rate of the original invoice, from its stored items.
    let origItems = itemsByInvoice.get(origInvoice.id)
    if (!origItems) {
      const { data } = await supabase
        .from('invoice_items')
        .select('taxable_amt, tax_amt')
        .eq('invoice_id', origInvoice.id)
      origItems = data || []
    }
    const taxableSum = (origItems || []).reduce((s: number, it: any) => s + Number(it.taxable_amt || 0), 0)
    const taxSum = (origItems || []).reduce((s: number, it: any) => s + Number(it.tax_amt || 0), 0)
    const taxRate = taxableSum > 0 ? snapRate((taxSum / taxableSum) * 100) : null

    creditNotes.push({
      note_number: note.note_number,
      note_date: String(note.created_at).split('T')[0],
      reason: note.reason || null,
      original_invoice_number: origInvoice.invoice_number,
      customer_gstin: origInvoice.customer_gstin || null,
      place_of_supply_state_code: origInvoice.place_of_supply_state_code || null,
      is_interstate: Boolean(origInvoice.is_interstate),
      taxable_amt: Number(note.subtotal) || 0,
      tax_amt: Number(note.tax_amt) || 0,
      total: Number(note.total) || 0,
      tax_rate: taxRate,
    })
  }

  return { gstr1Invoices, creditNotes, tallyInvoices }
}

/** Month helper: 'YYYY-MM' to its first and last dates plus the GSTR fp. */
export function monthRange(month: string): { from: string; to: string; fp: string } {
  const [y, m] = month.split('-').map(Number)
  const from = `${month}-01`
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const to = `${month}-${String(lastDay).padStart(2, '0')}`
  const fp = `${String(m).padStart(2, '0')}${y}`
  return { from, to, fp }
}
