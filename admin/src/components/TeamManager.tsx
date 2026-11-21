'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { btnPrimary, Card, inputCls, labelCls, Pill } from '@/components/ui'
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type AdminRole } from '@/lib/roles'

export interface TeamMember {
  id: string
  display_name: string
  email: string
  role: AdminRole
  status: string
}

const ROLES: AdminRole[] = ['founder', 'co_founder', 'support', 'finance', 'analyst']

/**
 * Team management (plan Sections 6H and 12). The founder account is
 * untouchable from here by anyone but the founder, and the server
 * enforces that again on every change; these buttons simply do not
 * pretend otherwise.
 */
export default function TeamManager({
  members,
  currentAdminId,
  currentRole,
}: {
  members: TeamMember[]
  currentAdminId: string
  currentRole: AdminRole
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AdminRole>('support')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [rowBusy, setRowBusy] = useState<string | null>(null)
  const [rowMsg, setRowMsg] = useState('')

  async function add() {
    setBusy(true)
    setMsg('')
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: name, email, role, password }),
      })
      const data = await res.json()
      if (!data.ok) {
        setMsg(data.error ?? 'Could not add the member.')
      } else {
        setName('')
        setEmail('')
        setPassword('')
        setMsg('Member added. Share the login details with them personally.')
        router.refresh()
      }
    } catch {
      setMsg('Could not add the member. Try again.')
    }
    setBusy(false)
  }

  async function update(member: TeamMember, patch: { status?: string; role?: string }) {
    setRowBusy(member.id)
    setRowMsg('')
    try {
      const res = await fetch('/api/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: member.id, ...patch }),
      })
      const data = await res.json()
      if (!data.ok) setRowMsg(data.error ?? 'Could not save.')
      else router.refresh()
    } catch {
      setRowMsg('Could not save. Try again.')
    }
    setRowBusy(null)
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.07]">
          {members.map((m) => {
            const locked =
              (m.role === 'founder' && currentRole !== 'founder') || m.id === currentAdminId
            return (
              <li key={m.id} className="px-5 py-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[180px]">
                  <p className="font-bold text-[15px]">
                    {m.display_name}
                    {m.id === currentAdminId ? (
                      <span className="text-[#86868B] font-medium"> (you)</span>
                    ) : null}
                  </p>
                  <p className="text-[13px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium">{m.email}</p>
                </div>
                <select
                  value={m.role}
                  disabled={locked || rowBusy === m.id}
                  onChange={(e) => update(m, { role: e.target.value })}
                  className="px-3 py-2 bg-white dark:bg-[#2C2C2E] border border-black/10 dark:border-white/10 rounded-full text-[13px] font-bold outline-none disabled:opacity-50"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
                <Pill tone={m.status === 'active' ? 'green' : 'red'}>
                  {m.status === 'active' ? 'Active' : 'Disabled'}
                </Pill>
                <button
                  disabled={locked || rowBusy === m.id}
                  onClick={() =>
                    update(m, { status: m.status === 'active' ? 'disabled' : 'active' })
                  }
                  className="px-3.5 py-2 rounded-full text-[13px] font-bold bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] active:scale-[0.98] transition-all disabled:opacity-40"
                >
                  {m.status === 'active' ? 'Disable' : 'Reactivate'}
                </button>
              </li>
            )
          })}
        </ul>
        {rowMsg ? <p className="px-5 py-3 text-[13px] font-medium text-red-600 dark:text-red-400">{rowMsg}</p> : null}
      </Card>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <Card className="p-5 md:p-6">
          <h2 className="text-[16px] font-bold mb-4">Add a team member</h2>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Full name</label>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Team member ka naam" />
            </div>
            <div>
              <label className={labelCls}>Email (their login)</label>
              <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@billdost.in" type="email" />
            </div>
            <div>
              <label className={labelCls}>Role</label>
              <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value as AdminRole)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Starting password</label>
              <input className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Kam se kam 8 characters" type="text" autoComplete="off" />
            </div>
            {msg ? <p className="text-[14px] font-medium">{msg}</p> : null}
            <button disabled={busy || !name.trim() || !email.trim()} onClick={add} className={btnPrimary}>
              {busy ? 'Adding...' : 'Add member'}
            </button>
          </div>
        </Card>

        <Card className="p-5 md:p-6">
          <h2 className="text-[16px] font-bold mb-3">What each role can do</h2>
          <ul className="space-y-3">
            {ROLES.map((r) => (
              <li key={r} className="text-[14px] leading-relaxed">
                <span className="font-bold">{ROLE_LABELS[r]}.</span>{' '}
                <span className="text-[#5A5A5E] dark:text-[#A1A1A6] font-medium">{ROLE_DESCRIPTIONS[r]}</span>
              </li>
            ))}
          </ul>
          <p className="text-[13px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium mt-4 leading-relaxed">
            Access begins and ends with this list. There is no other
            door into the portal, and disabling takes effect at once.
          </p>
        </Card>
      </div>
    </div>
  )
}
