'use client'

import { usePathname } from 'next/navigation'

/**
 * Content-only route transition. The shell (sidebar, topbar, bottom nav)
 * lives in DashboardShell above this wrapper and never remounts; only
 * the page content crossfades/slides, 240ms, transform and opacity only
 * (design brief speed rule). Disabled under prefers-reduced-motion by
 * the .page-enter media query in globals.css.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  )
}
