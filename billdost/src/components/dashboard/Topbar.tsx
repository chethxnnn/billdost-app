'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, Search, Settings, X } from 'lucide-react'
import ThemeToggle from '@/components/shared/Themetoggle'
import NotificationDropdown from '@/components/dashboard/NotificationDropdown'
import { GlobalSearch } from '@/components/dashboard/GlobalSearch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLogout } from '@/lib/use-logout'

interface Props {
  shopName: string
  userEmail: string
  userName: string
}

export default function Topbar({ shopName, userEmail, userName }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const logout = useLogout()
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

  const initials = userName
    ? userName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : userEmail?.charAt(0).toUpperCase() || '?'

  return (
    <header className="bg-white/70 dark:bg-[#1C1C1E]/70 backdrop-blur-2xl border-b border-black/5 dark:border-white/5 sticky top-0 z-30 transition-colors duration-300">
      <div className="h-[72px] px-4 lg:px-6 flex items-center justify-between relative">
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

        {/* Center section (Search bar, real: search.global) */}
        <div className="hidden sm:flex flex-1 justify-center max-w-md w-full absolute left-1/2 -translate-x-1/2">
          <GlobalSearch />
        </div>

        {/* Right section (Actions) */}
        <div className="flex-1 flex items-center justify-end gap-3">
          {/* Mobile search toggle */}
          <button
            type="button"
            onClick={() => setMobileSearchOpen((o) => !o)}
            aria-label={mobileSearchOpen ? 'Search band karo' : 'Search karo'}
            aria-expanded={mobileSearchOpen}
            className="sm:hidden w-11 h-11 inline-flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            {mobileSearchOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Search className="w-5 h-5" aria-hidden="true" />}
          </button>

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

          {/* User avatar menu: Settings + Logout (logout exists nowhere else on desktop before this) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Profile aur settings"
                className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1B7A4A] to-[#25D366] flex items-center justify-center text-white text-[13px] font-semibold hover:scale-105 transition-transform shadow-sm shadow-[#1B7A4A]/20 flex-shrink-0"
              >
                {initials}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-semibold truncate">{userName}</p>
                <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                <p className="text-xs text-muted-foreground truncate">{shopName}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/settings')} className="min-h-[44px] cursor-pointer">
                <Settings className="w-4 h-4 mr-2" aria-hidden="true" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void logout()} className="min-h-[44px] cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile search row (expands under the header, same real search) */}
      {mobileSearchOpen && (
        <div className="sm:hidden px-4 pb-3">
          <GlobalSearch autoFocus onNavigate={() => setMobileSearchOpen(false)} />
        </div>
      )}
    </header>
  )
}
