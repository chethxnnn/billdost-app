'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/useTranslation'

export default function BottomNav() {
  const pathname = usePathname()
  const { t } = useTranslation()

  const ITEMS = [
    { label: 'Home', href: '/dashboard', icon: HomeIcon, center: false },
    { label: t('sidebar', 'invoices'), href: '/invoices', icon: InvoiceIcon, center: false },
    { label: 'Bill', href: '/invoices/new', icon: PlusIcon, center: true },
    { label: t('sidebar', 'customers'), href: '/customers', icon: CustomersIcon, center: false },
    { label: 'More', href: '/settings', icon: MoreIcon, center: false },
  ]

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-2xl border-t border-black/5 dark:border-white/5 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_rgba(0,0,0,0.02)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.2)]">
      <div className="flex items-center justify-around h-[68px]">
        {ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href)

          if (item.center) {
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label="Naya bill banao"
                className="tap relative -mt-6 w-[56px] h-[56px] bg-gradient-to-br from-[#1B7A4A] to-[#25D366] rounded-full flex items-center justify-center shadow-lg shadow-[#1B7A4A]/30 hover:scale-105 transition-transform"
              >
                <Icon className="w-6 h-6 text-white" aria-hidden="true" />
              </Link>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 py-1 px-3 transition-colors ${
                isActive
                  ? 'text-[#1B7A4A] dark:text-[#25D366]'
                  : 'text-[#6E6E73] dark:text-[#98989D]'
              }`}
            >
              <Icon className={`w-[22px] h-[22px] transition-transform ${isActive ? 'scale-110 stroke-[2.5px]' : ''}`} />
              <span className="text-[10px] font-medium tracking-tight">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

function HomeIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
}
function InvoiceIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /></svg>
}
function PlusIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
}
function CustomersIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
}
function MoreIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg>
}