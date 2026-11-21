'use client'

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
  Sun,
  Moon,
  MoreHorizontal,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { can, ROLE_LABELS, type AdminRole, type Capability } from '@/lib/roles'
import QuickFinder from './QuickFinder'

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
  capability?: Capability
}

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, capability: 'dashboard' }],
  },
  {
    label: 'Work',
    items: [
      { href: '/applications', label: 'Applications', icon: Inbox, capability: 'applications' },
      { href: '/shops', label: 'Shops', icon: Store, capability: 'shops_view' },
      { href: '/issues', label: 'Issues', icon: Bug, capability: 'issues' },
    ],
  },
  {
    label: 'Reach',
    items: [{ href: '/broadcasts', label: 'Broadcasts', icon: Megaphone, capability: 'broadcasts' }],
  },
  {
    label: 'Business',
    items: [{ href: '/finance', label: 'Finance', icon: Wallet, capability: 'finance_view' }],
  },
  {
    label: 'System',
    items: [
      { href: '/team', label: 'Team', icon: Users, capability: 'team_manage' },
      { href: '/settings', label: 'Settings', icon: SettingsIcon, capability: 'settings' },
      { href: '/audit', label: 'Audit log', icon: ScrollText, capability: 'audit_view' },
    ],
  },
]

const MOBILE_MAIN: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard, capability: 'dashboard' },
  { href: '/applications', label: 'Requests', icon: Inbox, capability: 'applications' },
  { href: '/shops', label: 'Shops', icon: Store, capability: 'shops_view' },
  { href: '/issues', label: 'Issues', icon: Bug, capability: 'issues' },
]

function visible(item: NavItem, role: AdminRole): boolean {
  return !item.capability || can(role, item.capability)
}

function ThemeToggle() {
  function toggle() {
    const dark = document.documentElement.classList.toggle('dark')
    try {
      localStorage.setItem('billdost-admin-theme', dark ? 'dark' : 'light')
    } catch {
      // Private mode: the toggle still works for this session.
    }
  }
  return (
    <button
      onClick={toggle}
      className="p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
      aria-label="Toggle dark mode"
    >
      <Sun className="w-5 h-5 hidden dark:block" />
      <Moon className="w-5 h-5 dark:hidden" />
    </button>
  )
}

/**
 * The portal shell (plan Section 7): slim grouped sidebar on desktop,
 * bottom-safe navigation on phones, top bar with the quick finder and
 * nothing else competing. The shell mounts once and never remounts;
 * only the content area changes between screens.
 */
export default function Shell({
  admin,
  children,
}: {
  admin: { displayName: string; email: string; role: AdminRole }
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  const moreItems = GROUPS.flatMap((g) => g.items).filter(
    (i) => visible(i, admin.role) && !MOBILE_MAIN.some((m) => m.href === i.href)
  )

  return (
    <div className="min-h-screen flex">
      {/* Sidebar, desktop */}
      <aside className="hidden lg:flex flex-col w-[232px] shrink-0 sticky top-0 h-screen border-r border-black/[0.06] dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.02] backdrop-blur-xl px-3 py-5">
        <Link href="/dashboard" className="px-3 pb-5 font-extrabold text-[20px] tracking-tight">
          <span>Bill</span>
          <span className="text-[#1B7A4A] dark:text-[#25D366]">Dost</span>
          <span className="block text-[11px] font-bold uppercase tracking-widest text-[#5A5A5E] dark:text-[#A1A1A6] mt-0.5">
            Admin
          </span>
        </Link>
        <nav className="flex-1 overflow-y-auto space-y-5">
          {GROUPS.map((group) => {
            const items = group.items.filter((i) => visible(i, admin.role))
            if (items.length === 0) return null
            return (
              <div key={group.label}>
                <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-widest text-[#86868B]">
                  {group.label}
                </p>
                {items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[14px] font-semibold transition-colors duration-200 ${
                      isActive(item.href)
                        ? 'bg-[#1B7A4A]/10 text-[#14663C] dark:bg-[#25D366]/15 dark:text-[#25D366]'
                        : 'text-[#3A3A3C] dark:text-[#D1D1D6] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    <item.icon className="w-[18px] h-[18px]" />
                    {item.label}
                  </Link>
                ))}
              </div>
            )
          })}
        </nav>
        <div className="border-t border-black/[0.06] dark:border-white/[0.08] pt-4 px-3">
          <p className="text-[14px] font-bold truncate">{admin.displayName}</p>
          <p className="text-[12px] font-medium text-[#5A5A5E] dark:text-[#A1A1A6] truncate">
            {ROLE_LABELS[admin.role]} · {admin.email}
          </p>
          <button
            onClick={signOut}
            className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-[#5A5A5E] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-2 px-4 md:px-8 py-3 bg-[#F5F5F7]/80 dark:bg-black/70 backdrop-blur-xl border-b border-black/[0.05] dark:border-white/[0.07]">
          <Link href="/dashboard" className="lg:hidden font-extrabold text-[18px] tracking-tight mr-1">
            <span>Bill</span>
            <span className="text-[#1B7A4A] dark:text-[#25D366]">Dost</span>
          </Link>
          <div className="flex-1" />
          <QuickFinder />
          <ThemeToggle />
          <div
            className="hidden sm:flex w-9 h-9 rounded-full bg-[#1B7A4A] text-white items-center justify-center text-[13px] font-bold"
            title={`${admin.displayName} (${ROLE_LABELS[admin.role]})`}
          >
            {admin.displayName.slice(0, 1).toUpperCase()}
          </div>
          <button
            onClick={signOut}
            className="lg:hidden p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Sign out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </header>

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8 pb-24 lg:pb-10">
          <div className="page-enter" key={pathname}>
            {children}
          </div>
        </main>
      </div>

      {/* Bottom navigation, phones */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/85 dark:bg-[#1C1C1E]/90 backdrop-blur-xl border-t border-black/[0.06] dark:border-white/[0.08] pb-[env(safe-area-inset-bottom)]">
        <div className="flex">
          {MOBILE_MAIN.filter((i) => visible(i, admin.role)).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold min-h-[52px] justify-center ${
                isActive(item.href)
                  ? 'text-[#1B7A4A] dark:text-[#25D366]'
                  : 'text-[#5A5A5E] dark:text-[#A1A1A6]'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          ))}
          <details className="flex-1 group relative">
            <summary className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold min-h-[52px] justify-center text-[#5A5A5E] dark:text-[#A1A1A6] cursor-pointer list-none">
              <MoreHorizontal className="w-5 h-5" />
              More
            </summary>
            <div className="absolute bottom-full right-2 mb-2 w-52 bg-white dark:bg-[#2C2C2E] rounded-2xl shadow-2xl border border-black/[0.06] dark:border-white/10 p-2 pop-in">
              {moreItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                >
                  <item.icon className="w-[18px] h-[18px]" />
                  {item.label}
                </Link>
              ))}
            </div>
          </details>
        </div>
      </nav>
    </div>
  )
}
