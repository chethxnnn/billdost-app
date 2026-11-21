import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Shared portal primitives (Dock + Canvas system, Nov 22): white
 * cards with hairline borders and a 20px radius on one padding
 * scale. Every card row follows one internal system: a fixed leading
 * tile or avatar column, content on shared baselines, trailing
 * values right-aligned in tabular numbers. One green primary action
 * per screen, status pills that always carry a word, calm empty and
 * error states. No prop controls: everything rendered here works.
 */

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#1B7A4A] hover:bg-[#155F3A] active:scale-[0.98] text-white font-semibold rounded-full text-[14px] transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none shadow-sm shadow-[#1B7A4A]/20'

export const btnGhost =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent border border-black/10 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.98] text-[#1D1D1F] dark:text-[#F5F5F7] font-semibold rounded-full text-[14px] transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none'

export const btnDanger =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent border border-red-600/30 hover:bg-red-50 dark:hover:bg-red-500/10 active:scale-[0.98] text-red-700 dark:text-red-400 font-semibold rounded-full text-[14px] transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none'

export const inputCls =
  'w-full px-4 py-3 bg-white dark:bg-[#2C2C2E] border border-black/10 dark:border-white/10 rounded-2xl text-[15px] text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#86868B] outline-none focus:border-[#1B7A4A] dark:focus:border-[#25D366] focus:ring-4 focus:ring-[#1B7A4A]/10 dark:focus:ring-[#25D366]/10 transition-all duration-200'

export const labelCls =
  'block text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-1.5 ml-1'

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded-[20px] ${className}`}
    >
      {children}
    </div>
  )
}

/**
 * The fixed leading column of the card system: a 40px coloured tile
 * with one icon, or an avatar. Rows align because this column never
 * changes size.
 */
const TILE_TONES: Record<string, string> = {
  green: 'bg-[#1B7A4A]/10 text-[#14663C] dark:bg-[#25D366]/15 dark:text-[#25D366]',
  blue: 'bg-[#175CD3]/10 text-[#175CD3] dark:bg-[#175CD3]/25 dark:text-[#84B4F0]',
  purple: 'bg-[#7A4FA3]/10 text-[#7A4FA3] dark:bg-[#7A4FA3]/25 dark:text-[#C4A6E8]',
  amber: 'bg-[#B25E09]/10 text-[#9A5B07] dark:bg-[#B25E09]/25 dark:text-[#E8B06A]',
  teal: 'bg-[#0E7490]/10 text-[#0E7490] dark:bg-[#0E7490]/25 dark:text-[#6AC3E8]',
  pink: 'bg-[#B3261E]/10 text-[#B3261E] dark:bg-[#B3261E]/25 dark:text-[#F0938C]',
  neutral: 'bg-black/[0.05] text-[#5A5A5E] dark:bg-white/[0.08] dark:text-[#A1A1A6]',
}

export function Tile({
  tone = 'neutral',
  children,
}: {
  tone?: keyof typeof TILE_TONES
  children: ReactNode
}) {
  return (
    <span
      className={`w-10 h-10 shrink-0 rounded-[12px] flex items-center justify-center ${TILE_TONES[tone]}`}
      aria-hidden
    >
      {children}
    </span>
  )
}

const AVATAR_BG = ['#7A4FA3', '#175CD3', '#B25E09', '#0B7A3E', '#3A3A3C']

export function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_BG[h % AVATAR_BG.length]
}

export function Avatar({
  name,
  size = 40,
  presence,
}: {
  name: string
  size?: number
  presence?: 'active' | 'away' | null
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span
        className="w-full h-full rounded-full flex items-center justify-center text-white font-bold"
        style={{ backgroundColor: avatarColor(name), fontSize: size * 0.36 }}
      >
        {initials || '?'}
      </span>
      {presence ? (
        <span
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-[#1C1C1E] ${
            presence === 'active' ? 'bg-[#1B7A4A] dark:bg-[#25D366]' : 'bg-[#C7C7CC]'
          }`}
        />
      ) : null}
    </span>
  )
}

export function PageHeader({
  title,
  subtitle,
  action,
  sticky = false,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  /**
   * Detail pages pass sticky: the summary header pins under the
   * shell header (frosted, full-bleed across the canvas padding)
   * while the detail content scrolls beneath it, and releases at
   * the end of the page like everything else in the sticky system.
   */
  sticky?: boolean
}) {
  return (
    <div
      className={
        sticky
          ? 'sticky-bar -mx-4 md:-mx-6 px-4 md:px-6 -mt-6 md:-mt-8 py-4 mb-6 flex flex-wrap items-end justify-between gap-4'
          : 'flex flex-wrap items-end justify-between gap-4 mb-6'
      }
    >
      <div>
        <h1 className="text-[28px] md:text-[32px] font-extrabold tracking-tight leading-tight">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-[15px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium mt-1">
            {subtitle}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

export function StatCard({
  label,
  value,
  sub,
  href,
  attention,
}: {
  label: string
  value: string
  sub?: string
  href?: string
  attention?: boolean
}) {
  const inner = (
    <>
      <p className="text-[13px] font-semibold text-[#5A5A5E] dark:text-[#A1A1A6] uppercase tracking-wide">
        {label}
      </p>
      <p
        className={`text-[34px] leading-none font-extrabold tracking-tight tabular-nums mt-2 ${
          attention ? 'text-amber-600 dark:text-amber-400' : ''
        }`}
      >
        {value}
      </p>
      {sub ? (
        <p className="text-[13px] font-medium text-[#5A5A5E] dark:text-[#A1A1A6] mt-2">
          {sub}
        </p>
      ) : null}
    </>
  )
  const cls = 'block p-5 h-full'
  if (href) {
    return (
      <Card className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors duration-200">
        <Link href={href} className={cls}>
          {inner}
        </Link>
      </Card>
    )
  }
  return <Card className={cls}>{inner}</Card>
}

type Tone = 'green' | 'amber' | 'red' | 'neutral' | 'blue'

const TONE_CLASSES: Record<Tone, string> = {
  green:
    'bg-[#1B7A4A]/10 text-[#14663C] dark:bg-[#25D366]/15 dark:text-[#25D366]',
  amber:
    'bg-amber-500/10 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
  red: 'bg-red-500/10 text-red-700 dark:bg-red-400/15 dark:text-red-300',
  neutral:
    'bg-black/[0.05] text-[#5A5A5E] dark:bg-white/[0.08] dark:text-[#A1A1A6]',
  blue: 'bg-blue-500/10 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300',
}

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-bold whitespace-nowrap ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  )
}

const SHOP_STATUS: Record<string, { tone: Tone; label: string }> = {
  live: { tone: 'green', label: 'Live' },
  pending_activation: { tone: 'amber', label: 'Pending activation' },
  awaiting_approval: { tone: 'amber', label: 'Awaiting approval' },
  setup_returned: { tone: 'red', label: 'Changes requested' },
  suspended: { tone: 'red', label: 'Suspended' },
}

export function ShopStatusPill({ status }: { status: string }) {
  const s = SHOP_STATUS[status] ?? { tone: 'neutral' as Tone, label: status }
  return <Pill tone={s.tone}>{s.label}</Pill>
}

const REQUEST_STATUS: Record<string, { tone: Tone; label: string }> = {
  new: { tone: 'blue', label: 'New' },
  called: { tone: 'neutral', label: 'Called' },
  approved: { tone: 'neutral', label: 'Approved' },
  setup_done: { tone: 'amber', label: 'Setup done' },
  activation_sent: { tone: 'amber', label: 'Activation sent' },
  live: { tone: 'green', label: 'Live' },
  rejected: { tone: 'red', label: 'Rejected' },
}

export function RequestStatusPill({ status }: { status: string }) {
  const s = REQUEST_STATUS[status] ?? { tone: 'neutral' as Tone, label: status }
  return <Pill tone={s.tone}>{s.label}</Pill>
}

const ISSUE_STATUS: Record<string, { tone: Tone; label: string }> = {
  new: { tone: 'red', label: 'New' },
  investigating: { tone: 'amber', label: 'Investigating' },
  fixed: { tone: 'blue', label: 'Fixed' },
  informed: { tone: 'green', label: 'Informed' },
}

export function IssueStatusPill({ status }: { status: string }) {
  const s = ISSUE_STATUS[status] ?? { tone: 'neutral' as Tone, label: status }
  return <Pill tone={s.tone}>{s.label}</Pill>
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <Card className="p-10 text-center">
      <p className="text-[17px] font-bold">{title}</p>
      <p className="text-[14px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium mt-1.5 max-w-md mx-auto leading-relaxed">
        {body}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </Card>
  )
}

/**
 * Calm error state (plan Section 7): what happened in plain words, a
 * note that data is safe, and technical details hidden behind an
 * expand control. Raw error text never appears outside the expand.
 */
export function ErrorState({
  title = 'Something did not load',
  body = 'Your data is safe. Please try again in a moment.',
  details,
}: {
  title?: string
  body?: string
  details?: string
}) {
  return (
    <Card className="p-10 text-center">
      <p className="text-[17px] font-bold">{title}</p>
      <p className="text-[14px] text-[#5A5A5E] dark:text-[#A1A1A6] font-medium mt-1.5 max-w-md mx-auto leading-relaxed">
        {body}
      </p>
      {details ? (
        <details className="mt-5 text-left max-w-lg mx-auto">
          <summary className="cursor-pointer text-[13px] font-semibold text-[#5A5A5E] dark:text-[#A1A1A6]">
            Technical details
          </summary>
          <pre className="mt-2 text-[12px] whitespace-pre-wrap break-words bg-black/[0.04] dark:bg-white/[0.06] rounded-xl p-3 overflow-auto">
            {details}
          </pre>
        </details>
      ) : null}
    </Card>
  )
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-16 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] animate-pulse"
        />
      ))}
    </div>
  )
}
