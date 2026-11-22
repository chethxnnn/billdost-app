'use client'

import type { ComponentType } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher'
import { useLogout } from '@/lib/use-logout'
import { Globe, LogOut } from 'lucide-react'

interface Props {
  collapsed: boolean
  onToggle: () => void
  shopName: string
  shopCategory: string
  userName: string
  role: string
}

/* ─── Icon Components ─── */
function DashboardIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></svg>
}
function PlusIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
}
function InvoiceIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /></svg>
}
function QuoteIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></svg>
}
function CustomersIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
}
function CatalogIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 12 12 17 22 12" /><polyline points="2 17 12 22 22 17" /></svg>
}
function InventoryIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="8" x="2" y="3" rx="2" /><path d="M4 11v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><path d="M10 15h4" /></svg>
}
function AnalyticsIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
}
function GstIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M9 15l6-6" /><circle cx="9.5" cy="9.5" r="0.5" fill="currentColor" /><circle cx="14.5" cy="14.5" r="0.5" fill="currentColor" /></svg>
}
function PosIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="12" x="3" y="4" rx="2" /><path d="M2 20h20" /><path d="M12 8v4" /><path d="M10 10h4" /></svg>
}
function UdhaarIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg>
}
function PaymentsIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>
}
function ExpensesIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M8 7h8" /><path d="M8 11h8" /><path d="M8 15h5" /></svg>
}
function LowStockIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
}
function SettingsIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
}

interface NavItem {
  label: string
  href: string
  icon: ComponentType<{ className?: string }>
  badge: string | null
  accent?: boolean
}

interface NavGroup {
  key: string
  label: string
  items: NavItem[]
}

// Grouped navigation (Stage 5). The groups are sized so the whole
// rail fits a laptop viewport: compact 36px rows, tighter still on
// short screens, and NO internal scrollbar anywhere in the sidebar.
// The page scrolls; the sidebar never does.
const getNavGroups = (t: any): NavGroup[] => [
  {
    key: 'main',
    label: 'Main',
    items: [
      { label: t('sidebar', 'dashboard'), href: '/dashboard', icon: DashboardIcon, badge: null },
      { label: t('sidebar', 'new_bill'), href: '/invoices/new', icon: PlusIcon, badge: null, accent: true },
      { label: t('sidebar', 'pos'), href: '/pos', icon: PosIcon, badge: null },
      { label: t('sidebar', 'invoices'), href: '/invoices', icon: InvoiceIcon, badge: null },
      { label: t('sidebar', 'quotations'), href: '/quotations', icon: QuoteIcon, badge: null },
    ],
  },
  {
    key: 'manage',
    label: 'Manage',
    items: [
      { label: t('sidebar', 'customers'), href: '/customers', icon: CustomersIcon, badge: null },
      { label: t('sidebar', 'udhaar'), href: '/udhaar', icon: UdhaarIcon, badge: null },
      { label: t('sidebar', 'payments'), href: '/payments', icon: PaymentsIcon, badge: null },
      { label: t('sidebar', 'catalog'), href: '/catalog', icon: CatalogIcon, badge: null },
      { label: t('sidebar', 'inventory'), href: '/inventory', icon: InventoryIcon, badge: null },
      { label: t('sidebar', 'low_stock'), href: '/low-stock', icon: LowStockIcon, badge: null },
      { label: t('sidebar', 'expenses'), href: '/expenses', icon: ExpensesIcon, badge: null },
    ],
  },
  {
    key: 'account',
    label: 'Account',
    items: [
      { label: t('sidebar', 'analytics'), href: '/analytics', icon: AnalyticsIcon, badge: null },
      { label: t('sidebar', 'gst_report'), href: '/reports/gst', icon: GstIcon, badge: null },
      { label: 'WhatsApp', href: '/settings/whatsapp', icon: (props: any) => <Globe {...props} />, badge: null },
    ],
  },
]

const CASHIER_HIDDEN = ['/analytics', '/reports/gst', '/expenses', '/low-stock']

const rowClass =
  'relative flex items-center gap-3 px-3 h-9 [@media(max-height:840px)]:h-8 rounded-xl text-[13.5px] transition-colors duration-150 group'

export default function Sidebar({ collapsed, onToggle, shopName, shopCategory, userName, role }: Props) {
  const pathname = usePathname()
  const { t } = useTranslation()
  const logout = useLogout()

  const groups = getNavGroups(t)
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !(role === 'cashier' && CASHIER_HIDDEN.includes(item.href))
      ),
    }))
    .filter((group) => group.items.length > 0)

  const settingsVisible = role !== 'cashier'
  const settingsActive = pathname.startsWith('/settings') && !pathname.startsWith('/settings/whatsapp')
  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : ''
  const categoryLabel = shopCategory
    ? shopCategory.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
    : ''

  return (
    <aside
      className={`hidden lg:flex flex-col bg-white/70 dark:bg-[#1C1C1E]/70 backdrop-blur-2xl border-r border-black/5 dark:border-white/5 h-screen sticky top-0 transition-[width] duration-300 z-40 ${
        collapsed ? 'w-[72px]' : 'w-[248px]'
      }`}
    >
      {/* Shop identity header */}
      <div className="px-4 h-16 flex items-center gap-3 border-b border-black/5 dark:border-white/5 flex-shrink-0">
        <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-[#1B7A4A] to-[#25D366] shadow-sm shadow-[#1B7A4A]/20 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-[15px] font-semibold tracking-tight font-display">
            {shopName.charAt(0).toUpperCase()}
          </span>
        </div>
        <div
          className={`flex flex-col whitespace-nowrap transition-opacity duration-200 ${
            collapsed ? 'opacity-0 pointer-events-none w-0 overflow-hidden' : 'opacity-100 w-auto'
          }`}
        >
          <div className="font-semibold text-[15px] tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7] truncate leading-tight">
            {shopName}
          </div>
          <div className="text-[12px] font-medium text-[#6E6E73] dark:text-[#98989D] truncate leading-tight">
            {categoryLabel || 'BillDost'}
          </div>
        </div>
      </div>

      {/* Grouped nav: no overflow, no internal scrollbar */}
      <nav className="flex-1 min-h-0 px-3 py-4 flex flex-col gap-5 [@media(max-height:840px)]:gap-3.5">
        {groups.map((group) => (
          <div key={group.key}>
            {collapsed ? (
              <div className="mx-2 mb-2 border-t border-black/5 dark:border-white/10 first:border-t-0 first:mb-0" aria-hidden="true" />
            ) : (
              <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6E6E73] dark:text-[#98989D]">
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                const Icon = item.icon

                if (item.accent) {
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-label={item.label}
                      title={collapsed ? item.label : undefined}
                      className={`${rowClass} bg-[#1B7A4A] hover:bg-[#155F3A] active:scale-[0.98] text-white font-semibold shadow-sm shadow-[#1B7A4A]/20 ${
                        collapsed ? 'justify-center px-0' : ''
                      }`}
                    >
                      <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                      {!collapsed && <span className="tracking-tight">{item.label}</span>}
                    </Link>
                  )
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                    title={collapsed ? item.label : undefined}
                    className={`${rowClass} ${
                      isActive
                        ? 'text-[#1B7A4A] dark:text-[#25D366] font-semibold'
                        : 'text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/5 dark:hover:bg-white/5 font-medium active:scale-[0.99]'
                    } ${collapsed ? 'justify-center px-0' : ''}`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="sidebar-active-pill"
                        className="absolute inset-0 rounded-xl bg-[#1B7A4A]/10 dark:bg-[#25D366]/12"
                        transition={{ type: 'spring', stiffness: 500, damping: 38, mass: 0.9 }}
                        aria-hidden="true"
                      />
                    )}
                    <Icon className={`relative w-[18px] h-[18px] flex-shrink-0 transition-transform duration-150 group-hover:scale-105 ${isActive ? 'stroke-[2.5px]' : ''}`} />
                    {!collapsed && (
                      <>
                        <span className="relative flex-1 tracking-tight truncate">{item.label}</span>
                        {item.badge && (
                          <span className={`relative text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            item.badge.includes('low')
                              ? 'bg-[#FF3B30]/10 text-[#FF3B30] dark:bg-[#FF453A]/20 dark:text-[#FF453A]'
                              : 'bg-black/5 text-[#6E6E73] dark:bg-white/10 dark:text-[#98989D]'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom block: language, user card, settings, sign out, collapse */}
      <div className="px-3 pb-3 pt-2 border-t border-black/5 dark:border-white/5 flex-shrink-0 space-y-1">
        {!collapsed && (
          <div className="px-1 pb-1">
            <LanguageSwitcher />
          </div>
        )}

        {/* User card */}
        <div
          className={`flex items-center gap-2.5 rounded-2xl bg-black/[0.03] dark:bg-white/5 px-2.5 py-2 ${
            collapsed ? 'justify-center px-0 bg-transparent dark:bg-transparent' : ''
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-[#1B7A4A]/12 dark:bg-[#25D366]/15 flex items-center justify-center flex-shrink-0">
            <span className="text-[#1B7A4A] dark:text-[#25D366] text-[13px] font-bold">
              {(userName || shopName).charAt(0).toUpperCase()}
            </span>
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7] truncate leading-tight">
                {userName}
              </span>
              <span className="text-[11px] font-medium text-[#6E6E73] dark:text-[#98989D] leading-tight">
                {roleLabel}
              </span>
            </div>
          )}
        </div>

        {settingsVisible && (
          <Link
            href="/settings"
            aria-label={t('sidebar', 'settings')}
            aria-current={settingsActive ? 'page' : undefined}
            title={collapsed ? t('sidebar', 'settings') : undefined}
            className={`${rowClass} ${
              settingsActive
                ? 'text-[#1B7A4A] dark:text-[#25D366] font-semibold bg-[#1B7A4A]/10 dark:bg-[#25D366]/12'
                : 'text-[#6E6E73] dark:text-[#98989D] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] font-medium'
            } ${collapsed ? 'justify-center px-0' : ''}`}
          >
            <SettingsIcon className="w-[18px] h-[18px] flex-shrink-0" />
            {!collapsed && <span className="tracking-tight">{t('sidebar', 'settings')}</span>}
          </Link>
        )}

        <button
          onClick={() => void logout()}
          aria-label="Logout"
          title={collapsed ? 'Logout' : undefined}
          className={`${rowClass} w-full text-left text-[#FF3B30] dark:text-[#FF453A] hover:bg-[#FF3B30]/10 dark:hover:bg-[#FF453A]/10 font-medium ${
            collapsed ? 'justify-center px-0' : ''
          }`}
        >
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" aria-hidden="true" />
          {!collapsed && <span className="tracking-tight">Logout</span>}
        </button>

        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Sidebar kholo' : 'Sidebar band karo'}
          title={collapsed ? 'Expand' : 'Collapse'}
          className={`${rowClass} w-full text-left text-[#6E6E73] dark:text-[#98989D] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] font-medium ${
            collapsed ? 'justify-center px-0' : ''
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`flex-shrink-0 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} aria-hidden="true">
            <path d="M11 17l-5-5 5-5" /><path d="M18 17l-5-5 5-5" />
          </svg>
          {!collapsed && <span className="tracking-tight">Collapse</span>}
        </button>
      </div>
    </aside>
  )
}
