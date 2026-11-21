'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, Plus, Trash2 } from 'lucide-react'
import { btnPrimary, Card, inputCls, labelCls } from '@/components/ui'
import ActivationPanel from '@/components/ActivationPanel'

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

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'hinglish', label: 'Hinglish' },
  { value: 'kn', label: 'Kannada' },
]

/**
 * Shop Setup (plan Section 6C): the old wizard, rebuilt as one clear
 * form with a live checklist at the side. Saving calls
 * admin_create_shop_tx through the server. Done means the shop exists
 * AND the activation step is on screen.
 */
export default function SetupForm({ initial }: { initial: SetupInitial }) {
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
    } catch {
      setError('Setup failed. Check your connection and try again.')
    }
    setBusy(false)
  }

  if (createdShopId) {
    return (
      <Card className="p-6 md:p-8">
        <div className="w-14 h-14 bg-[#1B7A4A]/10 dark:bg-[#25D366]/15 rounded-2xl flex items-center justify-center mb-4">
          <Check className="w-7 h-7 text-[#1B7A4A] dark:text-[#25D366]" />
        </div>
        <h2 className="text-[22px] font-extrabold tracking-tight mb-1.5">
          {shopName} is set up
        </h2>
        <p className="text-[15px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium leading-relaxed mb-6">
          The shop exists and is waiting for activation. Send the link
          now, while you are still on the call, and watch it turn live.
        </p>
        <ActivationPanel shopId={createdShopId} />
        <div className="mt-6 pt-5 border-t border-black/[0.05] dark:border-white/[0.07]">
          <Link href={`/shops/${createdShopId}`} className="text-[14px] font-bold text-[#1B7A4A] dark:text-[#25D366] hover:underline underline-offset-4">
            Open the shop page
          </Link>
        </div>
      </Card>
    )
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4 items-start">
      <div className="lg:col-span-2 space-y-4">
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
                  <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>
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

      <Card className="p-5 md:p-6 lg:sticky lg:top-24">
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
          Creating is one transaction: shop, owner row, products and the
          audit entry. If anything fails, nothing is created.
        </p>
      </Card>
    </div>
  )
}
