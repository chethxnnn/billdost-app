'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { btnPrimary, Card, inputCls, Pill } from '@/components/ui'
import ThemeControl, { type UiTheme } from '@/components/ThemeControl'

/**
 * Platform settings (plan Section 6I): the two values the portal
 * owns (support phone, landing URL) are editable; everything that
 * belongs in the environment (WhatsApp keys, template names) is shown
 * read-only with its true state.
 */
export default function SettingsForm({
  uiTheme,
  supportPhone,
  landingUrl,
  waConnected,
  waNumberIdSet,
  activationTemplate,
  broadcastTemplate,
  templateLanguage,
}: {
  uiTheme: UiTheme
  supportPhone: string
  landingUrl: string
  waConnected: boolean
  waNumberIdSet: boolean
  activationTemplate: string
  broadcastTemplate: string
  templateLanguage: string
}) {
  const router = useRouter()
  const [phone, setPhone] = useState(supportPhone)
  const [url, setUrl] = useState(landingUrl)
  const [busy, setBusy] = useState<'phone' | 'url' | null>(null)
  const [msg, setMsg] = useState('')

  async function save(key: 'support_phone' | 'landing_url', value: string) {
    setBusy(key === 'support_phone' ? 'phone' : 'url')
    setMsg('')
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      })
      const data = await res.json()
      setMsg(data.ok ? 'Saved. It is live everywhere now.' : data.error ?? 'Could not save.')
      if (data.ok) router.refresh()
    } catch {
      setMsg('Could not save. Try again.')
    }
    setBusy(null)
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 md:p-6">
        <h2 className="text-[16px] font-bold mb-1.5">Appearance</h2>
        <p className="text-[13px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium mb-4 leading-relaxed">
          Your personal theme. Manual only: light by default, dark
          when you choose it. It follows your account, not your device.
        </p>
        <ThemeControl initialTheme={uiTheme} />
      </Card>

      <Card className="p-5 md:p-6">
        <h2 className="text-[16px] font-bold mb-1.5">Support phone</h2>
        <p className="text-[13px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium mb-4 leading-relaxed">
          Shown inside the shop app, on activation pages and in the
          WhatsApp templates. Leave empty to hide it.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input className={inputCls + ' flex-1'} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98XXX XXXXX" inputMode="tel" />
          <button disabled={busy !== null} onClick={() => save('support_phone', phone)} className={btnPrimary}>
            {busy === 'phone' ? 'Saving...' : 'Save'}
          </button>
        </div>
      </Card>

      <Card className="p-5 md:p-6">
        <h2 className="text-[16px] font-bold mb-1.5">Landing page URL</h2>
        <p className="text-[13px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium mb-4 leading-relaxed">
          Where the shop app sends people who look for a signup. The
          Request Access form lives there.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input className={inputCls + ' flex-1'} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://billdost.in" />
          <button disabled={busy !== null} onClick={() => save('landing_url', url)} className={btnPrimary}>
            {busy === 'url' ? 'Saving...' : 'Save'}
          </button>
        </div>
        {msg ? <p className="text-[14px] font-medium mt-4">{msg}</p> : null}
      </Card>

      <Card className="p-5 md:p-6">
        <h2 className="text-[16px] font-bold mb-4">WhatsApp connection</h2>
        <div className="flex items-center gap-3 mb-4">
          <Pill tone={waConnected ? 'green' : 'amber'}>
            {waConnected ? 'Connected' : 'Not connected'}
          </Pill>
          <p className="text-[13px] font-medium text-[#5A5A5E] dark:text-[#A1A1A6]">
            {waConnected
              ? 'Platform sends use the BillDost business number.'
              : 'Activation links and broadcasts fall back to copy and send manually.'}
          </p>
        </div>
        <dl className="space-y-2.5 text-[14px]">
          {[
            ['Access token', waConnected ? 'Set in environment' : 'Missing'],
            ['Sending number ID', waNumberIdSet ? 'Set in environment' : 'Missing'],
            ['Activation template', activationTemplate],
            ['Broadcast template', broadcastTemplate],
            ['Template language', templateLanguage],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-3">
              <dt className="w-44 shrink-0 font-semibold text-[#5A5A5E] dark:text-[#A1A1A6]">{label}</dt>
              <dd className="font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[13px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium mt-4 leading-relaxed">
          Keys live in the portal server environment, never in this
          screen and never in the browser.
        </p>
      </Card>

      <Card className="p-5 md:p-6">
        <h2 className="text-[16px] font-bold mb-2">About this portal</h2>
        <p className="text-[14px] font-medium text-[#5A5A5E] dark:text-[#A1A1A6] leading-relaxed">
          BillDost Admin Portal, version 0.1.0. It shares one Supabase
          project with the shop app and nothing else at runtime: two
          apps, one database, clean folders.
        </p>
      </Card>
    </div>
  )
}
