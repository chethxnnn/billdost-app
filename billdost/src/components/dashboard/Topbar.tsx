'use client'

import Link from 'next/link'
import ThemeToggle from '@/components/shared/Themetoggle'
import NotificationDropdown from '@/components/dashboard/NotificationDropdown'
import { motion } from 'framer-motion'
import { usePathname } from 'next/navigation'

interface Props {
  shopName: string
  userEmail: string
  userName: string
}

export default function Topbar({ shopName, userEmail, userName }: Props) {
  const pathname = usePathname()
  
  const initials = userName
    ? userName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : userEmail?.charAt(0).toUpperCase() || '?'

  return (
    <header className="h-[72px] bg-white/70 dark:bg-[#1C1C1E]/70 backdrop-blur-2xl border-b border-black/5 dark:border-white/5 px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30 transition-colors duration-300">
      {/* Left section (Logo) */}
      <div className="flex-1 flex items-center justify-start">
        <Link
          href="/dashboard"
          className="font-[800] text-[24px] tracking-tight flex-shrink-0 font-display flex items-center"
        >
          <span className="text-[#1D1D1F] dark:text-[#F5F5F7]">Bill</span>
          <span className="text-[#1B7A4A] dark:text-[#25D366]">Dost</span>
        </Link>
      </div>

      {/* Center section (Search bar) */}
      <div className="hidden sm:flex flex-1 justify-center max-w-md w-full absolute left-1/2 -translate-x-1/2">
        <div className="w-full flex items-center gap-2 bg-black/5 dark:bg-white/5 border border-transparent focus-within:border-[#1B7A4A]/30 dark:focus-within:border-[#25D366]/30 focus-within:bg-white dark:focus-within:bg-[#2C2C2E] rounded-2xl px-4 py-2.5 transition-all duration-300">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#86868B] dark:text-[#98989D] flex-shrink-0">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search invoices, customers..."
            className="flex-1 bg-transparent text-[15px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] placeholder:text-[#86868B] dark:placeholder:text-[#98989D] outline-none w-full"
          />
          <kbd className="hidden md:inline text-[11px] font-mono text-[#86868B] dark:text-[#98989D] bg-black/5 dark:bg-white/10 rounded-md px-1.5 py-0.5 font-semibold">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right section (Actions) */}
      <div className="flex-1 flex items-center justify-end gap-3">
        {/* Quick bill button (desktop) - Hidden on /dashboard and /invoices pages */}
        {!pathname.startsWith('/dashboard') && !pathname.startsWith('/invoices') && (
          <Link
            href="/invoices/new"
            className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 bg-[#1B7A4A] hover:bg-[#155F3A] text-white text-[14px] font-medium rounded-full transition-transform hover:scale-[0.98] shadow-sm shadow-[#1B7A4A]/20"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Naya Bill
          </Link>
        )}

        {/* Theme toggle */}
        <div className="hover:scale-105 transition-transform">
          <ThemeToggle />
        </div>

        {/* Notifications */}
        <NotificationDropdown />

        {/* User avatar */}
        <Link
          href="/settings"
          className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1B7A4A] to-[#25D366] flex items-center justify-center text-white text-[13px] font-semibold hover:scale-105 transition-transform shadow-sm shadow-[#1B7A4A]/20 flex-shrink-0"
        >
          {initials}
        </Link>
      </div>
    </header>
  )
}