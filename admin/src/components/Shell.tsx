'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Inbox,
  Store,
  Bug,
  Megaphone,
  Wallet,
  Users,
  Settings as SettingsIcon,
  ScrollText,
  LogOut,
  UserRound,
  Plus,
  LayoutGrid,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { can, ROLE_LABELS, type AdminRole, type Capability } from '@/lib/roles'
import { Avatar } from '@/components/ui'
import ThemeControl, { applyTheme, type UiTheme } from '@/components/ThemeControl'
import QuickFinder from './QuickFinder'

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
  capability?: Capability
}

/** The dock: the five places the team lives in all day. */
const DOCK: NavItem[] = [
  { href: '/dashboard', label: 'Today', icon: LayoutDashboard, capability: 'dashboard' },
  { href: '/applications', label: 'Pipeline', icon: Inbox, capability: 'applications' },
  { href: '/shops', label: 'Shops', icon: Store, capability: 'shops_view' },
  { href: '/issues', label: 'Issues', icon: Bug, capability: 'issues' },
  { href: '/team', label: 'Team', icon: Users, capability: 'team_view' },
]

/** Everything else, one tap away in the More sheet. */
const MORE: NavItem[] = [
  { href: '/shops/new', label: 'Set up a shop', icon: Plus, capability: 'shop_setup' },
  { href: '/broadcasts', label: 'Broadcasts', icon: Megaphone, capability: 'broadcasts' },
  { href: '/finance', label: 'Finance', icon: Wallet, capability: 'finance_view' },
  { href: '/audit', label: 'Audit log', icon: ScrollText, capability: 'audit_view' },
  { href: '/settings', label: 'Settings', icon: SettingsIcon, capability: 'settings' },
]

function visible(item: NavItem, role: AdminRole): boolean {
  return !item.capability || can(role, item.capability)
}

/**
 * The portal shell (Dock + Canvas, Nov 22): a frosted header with the
 * text wordmark, the page as a calm canvas, and a floating frosted
 * dock as the only navigation. The avatar opens the profile menu:
 * identity, My profile, the manual theme option, Settings, Sign out.
 * The shell mounts once and never remounts; only the content area
 * changes between screens. A throttled heartbeat keeps presence
 * honest for the Team screen.
 */
export default function Shell({
  admin,
  children,
}: {
  admin: { displayName: string; email: string; role: AdminRole; uiTheme: UiTheme }
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // The stored per-user theme wins on first paint after login; the
  // localStorage mirror (applied by the root script) is only a cache.
  useEffect(() => {
    try {
      if (!localStorage.getItem('billdost-admin-theme')) {
        applyTheme(admin.uiTheme)
      }
    } catch {
      applyTheme(admin.uiTheme)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Presence heartbeat: on mount, every two minutes, and whenever
  // the tab becomes visible again. The server throttles the write.
  useEffect(() => {
    let stopped = false
    const ping = () => {
      if (!stopped) fetch('/api/me/heartbeat', { method: 'POST' }).catch(() => {})
    }
    ping()
    const t = setInterval(ping, 2 * 60 * 1000)
    const onVis = () => {
      if (document.visibilityState === 'visible') ping()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      stopped = true
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  // Close overlays when the route changes (state adjusted during
  // render, the React-endorsed pattern for reacting to a prop-like
  // value without an effect).
  const [lastPath, setLastPath] = useState(pathname)
  if (pathname !== lastPath) {
    setLastPath(pathname)
    setMenuOpen(false)
    setMoreOpen(false)
  }

  useEffect(() => {
    if (!menuOpen) return
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  const dockItems = DOCK.filter((i) => visible(i, admin.role))
  const moreItems = MORE.filter((i) => visible(i, admin.role))

  return (
    <div className="min-h-dvh">
      {/* Frosted header */}
      <header className="sticky top-0 z-40 bg-[#F5F5F7]/80 dark:bg-black/70 backdrop-blur-[16px] border-b border-black/[0.05] dark:border-white/[0.07]">
        <div className="max-w-[1120px] mx-auto flex items-center gap-2 px-4 md:px-6 h-[60px]">
          <Link
            href="/dashboard"
            className="flex items-baseline gap-2 font-extrabold text-[20px] tracking-[-0.02em]"
            aria-label="BillDost Admin, go to Today"
          >
            BillDost
            <span className="text-[12px] font-bold uppercase tracking-widest text-[#86868B]">
              Admin
            </span>
          </Link>
          <div className="flex-1" />
          <QuickFinder />
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-full active:scale-[0.95] transition-transform duration-150"
              aria-label="Open profile menu"
              aria-expanded={menuOpen}
            >
              <Avatar name={admin.displayName} size={36} />
            </button>
            {menuOpen ? (
              <div className="pop-in-tr absolute right-0 top-[calc(100%+10px)] w-[300px] bg-white dark:bg-[#2C2C2E] rounded-[20px] shadow-2xl shadow-black/10 border border-black/[0.06] dark:border-white/10 p-2 z-50">
                <div className="flex items-center gap-3 px-3 py-3">
                  <Avatar name={admin.displayName} size={44} />
                  <div className="min-w-0">
                    <p className="font-bold text-[15px] truncate">{admin.displayName}</p>
                    <p className="text-[13px] font-medium text-[#5A5A5E] dark:text-[#A1A1A6] truncate">
                      {admin.email}
                    </p>
                    <p className="text-[12px] font-bold text-[#14663C] dark:text-[#25D366]">
                      {ROLE_LABELS[admin.role]}
                    </p>
                  </div>
                </div>
                <div className="h-px bg-black/[0.05] dark:bg-white/[0.08] mx-2" />
                <Link
                  href="/profile"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-[14px] font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                >
                  <UserRound className="w-[18px] h-[18px]" /> My profile
                </Link>
                <div className="px-3 py-2.5">
                  <p className="text-[12px] font-bold uppercase tracking-wide text-[#86868B] mb-2">
                    Theme
                  </p>
                  <ThemeControl initialTheme={admin.uiTheme} compact />
                </div>
                {can(admin.role, 'settings') ? (
                  <Link
                    href="/settings"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-[14px] font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                  >
                    <SettingsIcon className="w-[18px] h-[18px]" /> Settings
                  </Link>
                ) : null}
                <div className="h-px bg-black/[0.05] dark:bg-white/[0.08] mx-2" />
                <button
                  onClick={signOut}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-[14px] font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-left"
                >
                  <LogOut className="w-[18px] h-[18px]" /> Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* Canvas. Bottom padding clears the dock at every width,
          including the phone safe area, so the last card's actions
          are always reachable above it. */}
      <main className="w-full max-w-[1120px] mx-auto px-4 md:px-6 pt-6 md:pt-8 pb-[calc(150px+env(safe-area-inset-bottom,0px))] md:pb-[calc(168px+env(safe-area-inset-bottom,0px))]">
        <div className="page-enter" key={pathname}>
          {children}
        </div>
      </main>

      {/* Floating dock. Centred by left-1/2 + the translate utility
          alone (the entrance animation moves only Y, see globals).
          On phones the dock takes the full safe width and its items
          share it evenly with flex-1, so nothing can spill off the
          screen edges; the bottom offset includes the safe area. */}
      <nav
        className="dock-in fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] md:bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 z-40 bg-white/75 dark:bg-[#2C2C2E]/80 backdrop-blur-[18px] border border-black/[0.06] dark:border-white/10 shadow-xl shadow-black/[0.08] rounded-full p-1.5 flex items-center gap-1 w-[calc(100vw-1rem)] sm:w-auto sm:max-w-[calc(100vw-2rem)]"
        aria-label="Portal"
      >
        {dockItems.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 sm:flex-none min-w-0 flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 px-1 min-[420px]:px-2 sm:px-4 py-2 rounded-full text-[10px] min-[420px]:text-[11px] sm:text-[13px] font-bold transition-all duration-200 active:scale-[0.95] ${
                active
                  ? 'bg-[#1B7A4A] text-white dark:bg-[#25D366] dark:text-black shadow-sm'
                  : 'text-[#3A3A3C] dark:text-[#D1D1D6] hover:bg-black/[0.05] dark:hover:bg-white/[0.08]'
              }`}
            >
              <item.icon className="w-5 h-5 sm:w-[18px] sm:h-[18px] shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
        {moreItems.length > 0 ? (
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 sm:flex-none min-w-0 flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 px-1 min-[420px]:px-2 sm:px-4 py-2 rounded-full text-[10px] min-[420px]:text-[11px] sm:text-[13px] font-bold text-[#3A3A3C] dark:text-[#D1D1D6] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-all duration-200 active:scale-[0.95]"
          >
            <LayoutGrid className="w-5 h-5 sm:w-[18px] sm:h-[18px] shrink-0" />
            <span className="truncate">More</span>
          </button>
        ) : null}
      </nav>

      {/* More sheet */}
      {moreOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] fade-in flex items-end sm:items-center justify-center p-4 pb-[calc(6.75rem+env(safe-area-inset-bottom,0px))] sm:pb-4"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="sheet-up w-full max-w-md bg-white dark:bg-[#1C1C1E] rounded-[24px] shadow-2xl p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="px-3 pt-2 pb-3 text-[13px] font-bold uppercase tracking-widest text-[#86868B]">
              More of the portal
            </p>
            <div className="grid grid-cols-2 gap-2">
              {moreItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-[16px] bg-black/[0.03] dark:bg-white/[0.05] text-[14px] font-bold hover:bg-black/[0.05] dark:hover:bg-white/[0.08] active:scale-[0.98] transition-all"
                >
                  <item.icon className="w-5 h-5 text-[#14663C] dark:text-[#25D366]" />
                  {item.label}
                </Link>
              ))}
            </div>
            <button
              onClick={() => setMoreOpen(false)}
              className="w-full mt-3 py-3 rounded-full text-[14px] font-bold bg-black/[0.04] dark:bg-white/[0.07]"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
