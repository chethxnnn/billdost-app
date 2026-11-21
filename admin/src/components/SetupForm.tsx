'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, Clock3, Plus, Trash2 } from 'lucide-react'
import { btnPrimary, Card, inputCls, labelCls } from '@/components/ui'
import ActivationPanel from '@/components/ActivationPanel'
import { formatMoneyExact } from '@/lib/format'

export interface SetupInitial {
  requestId?: string
  shopName?: string
  ownerName?: string
  ownerMobile?: string
  category?: string
  city?: string
}

interface ProductRow {
  name: string
  price: string
  unit: string
}

const CATEGORIES = [
  'kirana',
  'provision',
  'hardware',
  'jewellery',
  'electronics',
  'medical',
  'garments',
  'footwear',
  'stationery',
  'other',
]

const CATEGORY_LABELS: Record<string, string> = {
  kirana: 'Kirana Store',
  provision: 'Provision Store',
  hardware: 'Hardware Store',
  jewellery: 'Jewellery',
  electronics: 'Electronics',
  medical: 'Medical Store',
  garments: 'Garments',
  footwear: 'Footwear',
  stationery: 'Stationery',
  other: 'Retail Shop',
}

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'hinglish', label: 'Hinglish' },
  { value: 'kn', label: 'Kannada' },
]

const SAMPLE_BASKET = [
  { name: 'Aashirvaad Atta 10kg', price: 480 },
  { name: 'Fortune Oil 1L', price: 340 },
  { name: 'Sugar 4kg', price: 176 },
]

/**
 * The Setup Studio (Dock + Canvas, Nov 22): the form on the left,
 * and on the right a live preview of what the shopkeeper will see:
 * their shop home on a phone, and a sample bill with correct tabular
 * math. Saving calls admin_create_shop_tx through the server. What
 * happens next depends on who you are: founder-level setups are
 * approved inline and go straight to the activation panel; teammate
 * setups land in awaiting_approval for the founder's decision, and
 * no activation link exists until then.
 */
export default function SetupForm({
  initial,
  canActivate,
}: {
  initial: SetupInitial
  canActivate: boolean
}) {
  const [shopName, setShopName] = useState(initial.shopName ?? '')
  const [ownerName, setOwnerName] = useState(initial.ownerName ?? '')
  const [ownerMobile, setOwnerMobile] = useState(initial.ownerMobile ?? '')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [category, setCategory] = useState(initial.category ?? 'kirana')
  const [address, setAddress] = useState(initial.city ?? '')
  const [state, setState] = useState('')
  const [gstin, setGstin] = useState('')
  const [upiId, setUpiId] = useState('')
  const [includeUpiQr, setIncludeUpiQr] = useState(true)
  const [language, setLanguage] = useState('hinglish')
  const [terms, setTerms] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [products, setProducts] = useState<ProductRow[]>([])
  const [productsLater, setProductsLater] = useState(false)
  const [mobileConfirmed, setMobileConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [createdShopId, setCreatedShopId] = useState<string | null>(null)
  const [createdStatus, setCreatedStatus] = useState<string>('')

  const checks = useMemo(
    () => [
      {
        label: 'Shop profile: name, owner and mobile',
        done: shopName.trim().length > 1 && ownerMobile.replace(/\D/g, '').length >= 10,
      },
      {
        label: 'Tax and payments (GSTIN, UPI), or leave for later',
        done: true,
        optional: true,
      },
      {
        label: 'Branding (logo, terms), or leave for later',
        done: true,
        optional: true,
      },
      {
        label: 'Starter products added, or marked for photo and PDF import later',
        done: products.some((p) => p.name.trim()) || productsLater,
      },
      {
        label: 'Owner mobile confirmed on the call',
        done: mobileConfirmed,
      },
    ],
    [shopName, ownerMobile, products, productsLater, mobileConfirmed]
  )
  const ready = checks.every((c) => c.done)

  async function submit() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/shops/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_name: shopName,
          owner_name: ownerName,
          owner_mobile: ownerMobile,
          owner_email: ownerEmail,
          category,
          address,
          state,
          gstin,
          upi_id: upiId,
          include_upi_qr: includeUpiQr,
          language,
          terms_conditions: terms,
          logo_url: logoUrl,
          request_id: initial.requestId ?? '',
          products: products
            .filter((p) => p.name.trim())
            .map((p) => ({
              name: p.name.trim(),
              price: Number(p.price) || 0,
              unit: p.unit || 'piece',
              category: null,
            })),
          staff: [],
        }),
      })
      const data = await res.json()
      if (!data.ok) {
        setError(data.error ?? 'Setup failed. Nothing was created; try again.')
        setBusy(false)
        return
      }
      setCreatedShopId(data.shop_id as string)
      setCreatedStatus((data.status as string) ?? '')
    } catch {
      setError('Setup failed. Check your connection and try again.')
    }
    setBusy(false)
  }

  if (createdShopId) {
    if (createdStatus === 'awaiting_approval') {
      return (
        <Card className="p-6 md:p-8">
          <div className="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-4">
            <Clock3 className="w-7 h-7 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-[22px] font-extrabold tracking-[-0.02em] mb-1.5">
            {shopName} is ready for founder review
          </h2>
          <p className="text-[15px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium leading-relaxed mb-6">
            The setup is complete and saved. Activation links are a
            founder decision: the shop now sits in Awaiting approval
            on the founder&apos;s Today queue, and no link exists until
            they approve it. You will see it move in the Pipeline.
          </p>
          <Link href={`/shops/${createdShopId}`} className="text-[14px] font-bold text-[#1B7A4A] dark:text-[#25D366] hover:underline underline-offset-4">
            Open the shop page
          </Link>
        </Card>
      )
    }
    return (
      <Card className="p-6 md:p-8">
        <div className="w-14 h-14 bg-[#1B7A4A]/10 dark:bg-[#25D366]/15 rounded-2xl flex items-center justify-center mb-4">
          <Check className="w-7 h-7 text-[#1B7A4A] dark:text-[#25D366]" />
        </div>
        <h2 className="text-[22px] font-extrabold tracking-[-0.02em] mb-1.5">
          {shopName} is set up
        </h2>
        <p className="text-[15px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium leading-relaxed mb-6">
          The shop exists and is waiting for activation. Send the link
          now, while you are still on the call, and watch it turn live.
        </p>
        {canActivate ? (
          <ActivationPanel shopId={createdShopId} />
        ) : (
          <p className="text-[14px] font-medium text-[#5A5A5E] dark:text-[#A1A1A6]">
            Your role cannot send activation links. The founder can send it from the shop page.
          </p>
        )}
        <div className="mt-6 pt-5 border-t border-black/[0.05] dark:border-white/[0.07]">
          <Link href={`/shops/${createdShopId}`} className="text-[14px] font-bold text-[#1B7A4A] dark:text-[#25D366] hover:underline underline-offset-4">
            Open the shop page
          </Link>
        </div>
      </Card>
    )
  }

  const previewShop = shopName.trim() || 'Your Shop'
  const previewOwnerFirst = ownerName.trim().split(' ')[0] || 'Owner'
  const previewCategory = CATEGORY_LABELS[category] ?? 'Retail Shop'
  const previewPlace = address.trim().split(',')[0] || 'Your city'
  const basket = products
    .filter((p) => p.name.trim())
    .slice(0, 3)
    .map((p) => ({ name: p.name.trim(), price: Number(p.price) || 0 }))
  const previewItems = basket.length > 0 ? basket : SAMPLE_BASKET
  const subtotal = previewItems.reduce((s, i) => s + i.price, 0)
  const gst = Math.round(subtotal * 5) / 100
  const total = subtotal + gst

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-4 items-start">
      <div className="space-y-4 min-w-0">
        <Card className="p-5 md:p-6">
          <h2 className="text-[16px] font-bold mb-4">Shop profile</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Shop name *</label>
              <input className={inputCls} value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="Ramdev Kirana" />
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Owner name</label>
              <input className={inputCls} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Owner ka naam" />
            </div>
            <div>
              <label className={labelCls}>Owner mobile (WhatsApp) *</label>
              <input className={inputCls} value={ownerMobile} onChange={(e) => setOwnerMobile(e.target.value)} placeholder="98765 43210" inputMode="tel" />
            </div>
            <div>
              <label className={labelCls}>Owner email (optional)</label>
              <input className={inputCls} value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="Khali chhodo to mobile se login id banegi" />
            </div>
            <div>
              <label className={labelCls}>App language</label>
              <select className={inputCls} value={language} onChange={(e) => setLanguage(e.target.value)}>
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Address / city</label>
              <input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Main Bazaar, Jaipur" />
            </div>
            <div>
              <label className={labelCls}>State</label>
              <input className={inputCls} value={state} onChange={(e) => setState(e.target.value)} placeholder="Rajasthan" />
            </div>
          </div>
        </Card>

        <Card className="p-5 md:p-6">
          <h2 className="text-[16px] font-bold mb-4">Tax and payments</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>GSTIN (optional)</label>
              <input className={inputCls} value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} placeholder="08ABCDE1234F1Z5" />
            </div>
            <div>
              <label className={labelCls}>UPI ID (optional)</label>
              <input className={inputCls} value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="dukaan@okhdfc" />
            </div>
          </div>
          <label className="flex items-center gap-2.5 mt-4 text-[14px] font-medium cursor-pointer">
            <input type="checkbox" checked={includeUpiQr} onChange={(e) => setIncludeUpiQr(e.target.checked)} className="w-4 h-4 accent-[#1B7A4A]" />
            Show UPI QR on bills by default
          </label>
        </Card>

        <Card className="p-5 md:p-6">
          <h2 className="text-[16px] font-bold mb-4">Branding</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Logo URL (optional)</label>
              <input className={inputCls} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <label className={labelCls}>Terms line on bills (optional)</label>
              <input className={inputCls} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Goods once sold will not be taken back" />
            </div>
          </div>
        </Card>

        <Card className="p-5 md:p-6">
          <h2 className="text-[16px] font-bold mb-1.5">Starter products</h2>
          <p className="text-[13px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium mb-4">
            Add the first items now, or mark it for later. Category
            starter packs land here once you supply them; photo and PDF
            import fills the rest after activation.
          </p>
          <div className="space-y-2">
            {products.map((p, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className={inputCls + ' flex-1'}
                  value={p.name}
                  onChange={(e) => {
                    const next = [...products]
                    next[i] = { ...next[i], name: e.target.value }
                    setProducts(next)
                  }}
                  placeholder="Product name"
                />
                <input
                  className={inputCls + ' w-28'}
                  value={p.price}
                  onChange={(e) => {
                    const next = [...products]
                    next[i] = { ...next[i], price: e.target.value }
                    setProducts(next)
                  }}
                  placeholder="Price"
                  inputMode="decimal"
                />
                <button
                  onClick={() => setProducts(products.filter((_, j) => j !== i))}
                  className="p-3 rounded-2xl hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500"
                  aria-label="Remove product"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-4">
            <button
              onClick={() => setProducts([...products, { name: '', price: '', unit: 'piece' }])}
              className="inline-flex items-center gap-1.5 text-[14px] font-bold text-[#1B7A4A] dark:text-[#25D366]"
            >
              <Plus className="w-4 h-4" /> Add product
            </button>
            <label className="flex items-center gap-2.5 text-[14px] font-medium cursor-pointer">
              <input type="checkbox" checked={productsLater} onChange={(e) => setProductsLater(e.target.checked)} className="w-4 h-4 accent-[#1B7A4A]" />
              Products later (photo / PDF import)
            </label>
          </div>
        </Card>
      </div>

      {/* Live preview rail */}
      <div className="space-y-4 lg:sticky lg:top-[84px]">
        <div className="mx-auto w-[262px] rounded-[38px] bg-[#1D1D1F] p-[10px] shadow-xl shadow-black/10">
          <div className="rounded-[30px] bg-[#F5F5F7] overflow-hidden">
            <div className="px-5 pt-5 pb-4">
              <p className="font-extrabold text-[15px] tracking-[-0.02em]">BillDost</p>
              <p className="text-[20px] font-extrabold tracking-[-0.02em] mt-3 leading-tight">{previewShop}</p>
              <p className="text-[12px] font-medium text-[#6E6E73]">
                Namaste, {previewOwnerFirst} · {previewCategory}, {previewPlace}
              </p>
              <div className="mt-4 bg-white rounded-[16px] p-3.5 border border-black/[0.05]">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#86868B]">Aaj ki pehli bill</p>
                <p className="text-[22px] font-extrabold tabular-nums mt-1">{formatMoneyExact(total)}</p>
                <p className="text-[12px] font-medium text-[#6E6E73] mt-0.5">
                  UPI: {upiId.trim() || 'yourshop@upi'}
                </p>
              </div>
              <div className="mt-3 bg-[#1B7A4A] text-white text-center text-[13px] font-bold rounded-full py-2.5">
                Nayi bill banao
              </div>
            </div>
          </div>
        </div>

        <Card className="p-5">
          <p className="text-[12px] font-bold uppercase tracking-wide text-[#86868B] mb-1">
            Sample bill preview
          </p>
          <p className="font-bold text-[15px]">{previewShop}</p>
          <p className="text-[12px] font-medium text-[#86868B] mb-3">
            {previewCategory}, {previewPlace}
          </p>
          <ul className="space-y-1.5 text-[13px] font-medium">
            {previewItems.map((item) => (
              <li key={item.name} className="flex items-baseline gap-2">
                <span className="flex-1 truncate">{item.name}</span>
                <span className="tabular-nums">{formatMoneyExact(item.price)}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-dashed border-black/[0.12] dark:border-white/[0.15] mt-3 pt-2.5 space-y-1 text-[13px] font-medium">
            <p className="flex"><span className="flex-1">Subtotal</span><span className="tabular-nums">{formatMoneyExact(subtotal)}</span></p>
            <p className="flex"><span className="flex-1">GST (5%)</span><span className="tabular-nums">{formatMoneyExact(gst)}</span></p>
            <p className="flex font-extrabold text-[15px]"><span className="flex-1">Total</span><span className="tabular-nums">{formatMoneyExact(total)}</span></p>
          </div>
          <p className="text-[11px] font-medium text-[#86868B] mt-3 leading-relaxed">
            Preview math uses a flat 5% GST for illustration; real bills
            compute GST per item, on the discounted value.
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="text-[16px] font-bold mb-4">Setup checklist</h2>
          <ul className="space-y-3 mb-6">
            {checks.map((c) => (
              <li key={c.label} className="flex items-start gap-2.5 text-[14px] font-medium leading-snug">
                <span
                  className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                    c.done
                      ? 'bg-[#1B7A4A] text-white'
                      : 'bg-black/[0.06] dark:bg-white/[0.1] text-transparent'
                  }`}
                >
                  <Check className="w-3 h-3" />
                </span>
                <span className={c.done ? '' : 'text-[#5A5A5E] dark:text-[#A1A1A6]'}>{c.label}</span>
              </li>
            ))}
          </ul>
          <label className="flex items-start gap-2.5 text-[14px] font-medium cursor-pointer mb-5">
            <input type="checkbox" checked={mobileConfirmed} onChange={(e) => setMobileConfirmed(e.target.checked)} className="w-4 h-4 mt-0.5 accent-[#1B7A4A]" />
            Owner mobile confirmed on the call. The activation link will serve this number.
          </label>
          {error ? (
            <p className="mb-4 text-[14px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-2xl px-4 py-3">
              {error}
            </p>
          ) : null}
          <button disabled={!ready || busy} onClick={submit} className={btnPrimary + ' w-full'}>
            {busy ? 'Creating the shop...' : 'Create shop'}
          </button>
          <p className="text-[12px] text-[#86868B] font-medium mt-3 leading-relaxed">
            {canActivate
              ? 'Creating is one transaction: shop, owner row, products and the audit entry. If anything fails, nothing is created.'
              : 'Creating is one transaction. Your setup then goes to the founder for approval; the activation link is released only after that.'}
          </p>
        </Card>
      </div>
    </div>
  )
}
