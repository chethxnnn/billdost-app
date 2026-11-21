import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ThermalReceipt } from '@/components/invoices/ThermalReceipt'
import { AutoPrint } from './AutoPrint'

export const metadata = {
  title: 'Thermal Print | BillDost',
  robots: { index: false, follow: false },
}

/**
 * Standalone thermal print surface (blueprint D3): renders ONLY the
 * receipt at the shop's paper width and opens the print dialog. It
 * lives outside the dashboard shell so no navigation or chrome can
 * leak onto the paper. Data is read with the session client, so RLS
 * and shop membership apply exactly as everywhere else.
 */
export default async function ThermalPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('staff_members')
    .select('shop_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .single()

  if (!membership) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <p className="text-sm font-medium text-gray-600">Koi shop linked nahi hai is account se.</p>
      </main>
    )
  }

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('shop_id', membership.shop_id)
    .single()

  if (!invoice) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <p className="text-sm font-medium text-gray-600">Bill nahi mila.</p>
      </main>
    )
  }

  const { data: items } = await supabase
    .from('invoice_items')
    .select('name, quantity, unit_price, total')
    .eq('invoice_id', invoice.id)
    .order('sort_order', { ascending: true })

  const { data: shop } = await supabase
    .from('shops')
    .select('name, address, phone, gstin, upi_id, terms_conditions, thermal_width, print_upi_qr')
    .eq('id', membership.shop_id)
    .single()

  if (!shop) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <p className="text-sm font-medium text-gray-600">Shop details nahi mile.</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-100 print:bg-white py-4 print:py-0">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { margin: 0; }
        }
      `}</style>
      <AutoPrint invoiceId={invoice.id} />
      <ThermalReceipt
        invoice={{ ...invoice, items: items ?? [] }}
        shop={shop}
      />
    </main>
  )
}
