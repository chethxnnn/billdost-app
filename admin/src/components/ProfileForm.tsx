'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, btnPrimary, Card, inputCls, labelCls } from '@/components/ui'
import ThemeControl, { type UiTheme } from '@/components/ThemeControl'
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type AdminRole } from '@/lib/roles'

/**
 * My profile: who I am in the portal, my display name (editable),
 * and my personal theme choice. Role and email are shown, never
 * edited here; those belong to team management.
 */
export default function ProfileForm({
  displayName,
  email,
  role,
  uiTheme,
}: {
  displayName: string
  email: string
  role: AdminRole
  uiTheme: UiTheme
}) {
  const router = useRouter()
  const [name, setName] = useState(displayName)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function save() {
    setBusy(true)
    setMsg('')
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: name }),
      })
      const data = await res.json()
      if (!data.ok) {
        setMsg(data.error ?? 'Could not save.')
      } else {
        setMsg('Saved.')
        router.refresh()
      }
    } catch {
      setMsg('Could not save. Try again.')
    }
    setBusy(false)
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <Card className="p-5 md:p-6">
        <div className="flex items-center gap-4 mb-5">
          <Avatar name={displayName} size={56} />
          <div className="min-w-0">
            <p className="font-extrabold text-[20px] tracking-[-0.02em] truncate">{displayName}</p>
            <p className="text-[14px] font-medium text-[#5A5A5E] dark:text-[#A1A1A6] truncate">{email}</p>
            <p className="text-[13px] font-bold text-[#14663C] dark:text-[#25D366]">{ROLE_LABELS[role]}</p>
          </div>
        </div>
        <div>
          <label className={labelCls} htmlFor="display-name">Display name</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="display-name"
              className={inputCls + ' flex-1'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name, as the team sees it"
            />
            <button
              disabled={busy || name.trim() === displayName || name.trim().length < 2}
              onClick={save}
              className={btnPrimary}
            >
              {busy ? 'Saving...' : 'Save name'}
            </button>
          </div>
          {msg ? <p className="text-[14px] font-medium mt-3">{msg}</p> : null}
        </div>
        <p className="text-[13px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium mt-5 leading-relaxed">
          {ROLE_DESCRIPTIONS[role]} Your role and email are managed by
          the founder in Team.
        </p>
      </Card>

      <Card className="p-5 md:p-6">
        <h2 className="text-[16px] font-bold mb-1.5">Theme</h2>
        <p className="text-[13px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium mb-4 leading-relaxed">
          Your choice, yours only. Light is the default; nothing here
          follows your device setting.
        </p>
        <ThemeControl initialTheme={uiTheme} />
      </Card>
    </div>
  )
}
