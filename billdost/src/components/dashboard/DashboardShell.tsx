'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { MotionConfig } from 'framer-motion'
import Sidebar from '@/components/dashboard/Sidebar'
import Topbar from '@/components/dashboard/Topbar'
import BottomNav from '@/components/dashboard/BottomNav'
import { TRPCProvider } from '@/components/shared/TRPCProvider'
import { ShopProvider } from '@/components/shared/ShopContext'
import { PageTransition } from '@/components/shared/PageTransition'
import { LanguageSync } from '@/components/shared/LanguageSync'

interface Props {
  shopId: string
  shopName: string
  shopCategory: string
  shopLanguage?: string | null
  userEmail: string
  userName: string
  role: string
  children: React.ReactNode
}

export default function DashboardShell({ shopId, shopName, shopCategory, shopLanguage, userEmail, userName, role, children }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const pathname = usePathname()

  // The main content area is the scroller (not the window), so the
  // browser's own scroll restoration never sees it. Save each route's
  // scroll position and restore it on back/forward navigation only, so
  // list -> detail -> back feels like one surface (design brief).
  useEffect(() => {
    const onPopState = () => sessionStorage.setItem('bd-popstate', '1')
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    if (sessionStorage.getItem('bd-popstate') === '1') {
      sessionStorage.removeItem('bd-popstate')
      const y = Number(sessionStorage.getItem(`bd-main-scroll:${pathname}`) || 0)
      if (y > 0) requestAnimationFrame(() => { el.scrollTop = y })
    }
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        sessionStorage.setItem(`bd-main-scroll:${pathname}`, String(el.scrollTop))
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [pathname])

  return (
    <TRPCProvider>
      <ShopProvider shopId={shopId} shopName={shopName} shopCategory={shopCategory} role={role}>
        <MotionConfig reducedMotion="user">
          <LanguageSync shopLanguage={shopLanguage} />
          <div className="min-h-screen bg-gray-50 dark:bg-[#000000] flex">
            {/* Sidebar (desktop only) */}
            <Sidebar
              collapsed={collapsed}
              onToggle={() => setCollapsed((c) => !c)}
              shopName={shopName}
              shopCategory={shopCategory}
              userName={userName}
              role={role}
            />

            {/* Main area */}
            <div className="flex-1 flex flex-col min-w-0">
              <Topbar
                shopName={shopName}
                userEmail={userEmail}
                userName={userName}
              />

              {/* Page content: only this area transitions on navigation */}
              <main ref={mainRef} className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6 overflow-y-auto">
                <PageTransition>{children}</PageTransition>
              </main>
            </div>

            {/* Bottom nav (mobile only) */}
            <BottomNav />
          </div>
        </MotionConfig>
      </ShopProvider>
    </TRPCProvider>
  )
}
