'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { btnPrimary, Card, inputCls, labelCls } from '@/components/ui'
import { formatDateTime } from '@/lib/format'

export interface AnnouncementRow {
  id: string
  title: string
  body: string
  audience: string
  category: string | null
  starts_at: string
  ends_at: string | null
}

export interface BroadcastLogRow {
  id: string
  template_name: string
  audience: string
  recipient_count: number
  sent_count: number
  failed_count: number
  status: string
  created_at: string
}

/**
 * Broadcasts (plan Section 6F): two channels, one screen. In-app
 * announcements appear inside the shop app with a time window.
 * WhatsApp broadcasts use an approved template and are logged before
 * they start, so a double click can never send twice. When WhatsApp
 * is not connected, the composer says so plainly.
 */
export default function BroadcastComposer({
  announcements,
  log,
  shops,
  categories,
  waConnected,
  waTemplate,
}: {
  announcements: AnnouncementRow[]
  log: BroadcastLogRow[]
  shops: { id: string; name: string }[]
  categories: string[]
  waConnected: boolean
  waTemplate: string
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'announcement' | 'whatsapp'>('announcement')

  // Announcement form
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState('all')
  const [category, setCategory] = useState(categories[0] ?? '')
  const [shopId, setShopId] = useState(shops[0]?.id ?? '')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [aBusy, setABusy] = useState(false)
  const [aMsg, setAMsg] = useState('')

  // WhatsApp form
  const [message, setMessage] = useState('')
  const [wAudience, setWAudience] = useState('all')
  const [wCategory, setWCategory] = useState(categories[0] ?? '')
  const [wShopId, setWShopId] = useState(shops[0]?.id ?? '')
  const [confirming, setConfirming] = useState(false)
  const [wBusy, setWBusy] = useState(false)
  const [wMsg, setWMsg] = useState('')

  async function createAnnouncement() {
    setABusy(true)
    setAMsg('')
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          body,
          audience,
          category,
          shop_id: shopId,
          starts_at: startsAt || null,
          ends_at: endsAt || null,
        }),
      })
      const data = await res.json()
      if (!data.ok) {
        setAMsg(data.error ?? 'Could not save.')
      } else {
        setTitle('')
        setBody('')
        setAMsg('Announcement saved. It will appear in the app inside its window.')
        router.refresh()
      }
    } catch {
      setAMsg('Could not save. Try again.')
    }
    setABusy(false)
  }

  async function removeAnnouncement(id: string) {
    try {
      await fetch(`/api/announcements?id=${id}`, { method: 'DELETE' })
      router.refresh()
    } catch {
      // The list refresh will show the truth either way.
    }
  }

  async function sendBroadcast() {
    setWBusy(true)
    setWMsg('')
    try {
      const res = await fetch('/api/broadcasts/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          audience: wAudience,
          category: wCategory,
          shop_id: wShopId,
        }),
      })
      const data = await res.json()
      if (!data.ok) {
        setWMsg(data.error ?? 'Could not send.')
      } else if (!data.connected) {
        setWMsg(data.message as string)
      } else {
        setWMsg(`Sent to ${data.sent} shops${data.failed ? `, ${data.failed} failed` : ''}.`)
        setMessage('')
      }
      setConfirming(false)
      router.refresh()
    } catch {
      setWMsg('Could not send. Try again.')
    }
    setWBusy(false)
  }

  const audienceSelect = (
    value: string,
    setValue: (v: string) => void,
    cat: string,
    setCat: (v: string) => void,
    shop: string,
    setShop: (v: string) => void
  ) => (
    <div className="grid sm:grid-cols-2 gap-3">
      <div>
        <label className={labelCls}>Audience</label>
        <select className={inputCls} value={value} onChange={(e) => setValue(e.target.value)}>
          <option value="all">All live shops</option>
          <option value="category">One category</option>
          <option value="shop">One shop</option>
        </select>
      </div>
      {value === 'category' ? (
        <div>
          <label className={labelCls}>Category</label>
          <select className={inputCls} value={cat} onChange={(e) => setCat(e.target.value)}>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      ) : null}
      {value === 'shop' ? (
        <div>
          <label className={labelCls}>Shop</label>
          <select className={inputCls} value={shop} onChange={(e) => setShop(e.target.value)}>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  )

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(['announcement', 'whatsapp'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 rounded-full text-[14px] font-bold transition-colors duration-200 ${
              tab === t
                ? 'bg-[#1D1D1F] text-white dark:bg-white dark:text-black'
                : 'bg-black/[0.04] dark:bg-white/[0.07] hover:bg-black/[0.08] dark:hover:bg-white/[0.12]'
            }`}
          >
            {t === 'announcement' ? 'In-app announcement' : 'WhatsApp broadcast'}
          </button>
        ))}
      </div>

      {tab === 'announcement' ? (
        <Card className="p-5 md:p-6">
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Title</label>
              <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New: CA-ready GSTR-1 export" />
            </div>
            <div>
              <label className={labelCls}>Message</label>
              <textarea className={inputCls + ' resize-none'} rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="One clear line. The shopkeeper reads this inside the app." />
            </div>
            {audienceSelect(audience, setAudience, category, setCategory, shopId, setShopId)}
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Starts (blank = now)</label>
                <input type="datetime-local" className={inputCls} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Ends (blank = no end)</label>
                <input type="datetime-local" className={inputCls} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              </div>
            </div>
            {aMsg ? <p className="text-[14px] font-medium">{aMsg}</p> : null}
            <button disabled={aBusy || !title.trim() || !body.trim()} onClick={createAnnouncement} className={btnPrimary}>
              {aBusy ? 'Saving...' : 'Publish announcement'}
            </button>
          </div>
        </Card>
      ) : (
        <Card className="p-5 md:p-6">
          {!waConnected ? (
            <p className="text-[14px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 rounded-2xl px-4 py-3 mb-4 leading-relaxed">
              WhatsApp is not connected yet. You can prepare the message,
              but sending will only record the attempt until the Cloud
              API keys are added to the portal environment.
            </p>
          ) : null}
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Message (template: {waTemplate})</label>
              <textarea className={inputCls + ' resize-none'} rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="The one line that fills the announcement template." />
            </div>
            {audienceSelect(wAudience, setWAudience, wCategory, setWCategory, wShopId, setWShopId)}
            {wMsg ? <p className="text-[14px] font-medium">{wMsg}</p> : null}
            {confirming ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-[14px] font-semibold">Send to {wAudience === 'all' ? 'all live shops' : wAudience === 'category' ? `${wCategory} shops` : 'the selected shop'}?</p>
                <button disabled={wBusy} onClick={sendBroadcast} className={btnPrimary}>
                  {wBusy ? 'Sending...' : 'Yes, send it'}
                </button>
                <button disabled={wBusy} onClick={() => setConfirming(false)} className="text-[14px] font-bold">
                  Not yet
                </button>
              </div>
            ) : (
              <button disabled={!message.trim()} onClick={() => setConfirming(true)} className={btnPrimary}>
                Review and send
              </button>
            )}
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-3 md:gap-4 mt-4">
        <Card className="p-5">
          <h2 className="text-[16px] font-bold mb-3">Announcements</h2>
          {announcements.length === 0 ? (
            <p className="text-[14px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium">
              None yet. Your first announcement will appear here and inside the app.
            </p>
          ) : (
            <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.07]">
              {announcements.map((a) => (
                <li key={a.id} className="py-3 flex gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[14px]">{a.title}</p>
                    <p className="text-[13px] font-medium text-[#5A5A5E] dark:text-[#A1A1A6] leading-relaxed">{a.body}</p>
                    <p className="text-[12px] text-[#86868B] font-medium mt-1">
                      {a.audience}{a.category ? ` · ${a.category}` : ''} · from {formatDateTime(a.starts_at)}
                      {a.ends_at ? ` to ${formatDateTime(a.ends_at)}` : ''}
                    </p>
                  </div>
                  <button onClick={() => removeAnnouncement(a.id)} className="p-2 h-fit rounded-full hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500" aria-label="Remove announcement">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-[16px] font-bold mb-3">WhatsApp history</h2>
          {log.length === 0 ? (
            <p className="text-[14px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium">
              No broadcasts yet. Every send, and every honest failure, is recorded here.
            </p>
          ) : (
            <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.07]">
              {log.map((l) => (
                <li key={l.id} className="py-3">
                  <p className="font-bold text-[14px]">
                    {l.template_name} · {l.status.replace('_', ' ')}
                  </p>
                  <p className="text-[12px] text-[#86868B] font-medium mt-0.5">
                    {l.audience} · {l.sent_count} sent, {l.failed_count} failed of {l.recipient_count} · {formatDateTime(l.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
