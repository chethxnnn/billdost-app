'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'

const THEME_EVENT = 'billdost-theme-change'

function subscribeTheme(callback: () => void) {
  window.addEventListener(THEME_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(THEME_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

export type UiTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'billdost-admin-theme'

export function applyTheme(theme: UiTheme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Private mode: the choice still applies for this session.
  }
}

export function readStoredTheme(): UiTheme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

/**
 * The manual Light / Dark option (founder decision, Nov 22: no
 * automatic theme, ever). Applies instantly from localStorage and
 * persists to the admin's own row (admin_users.ui_theme) so the
 * choice follows them across devices.
 */
export default function ThemeControl({
  initialTheme,
  compact = false,
}: {
  initialTheme?: UiTheme
  compact?: boolean
}) {
  // The stored choice is the source of truth on the client; the
  // server snapshot is the account's saved theme, so first paint and
  // hydration agree.
  const theme = useSyncExternalStore(
    subscribeTheme,
    readStoredTheme,
    () => initialTheme ?? 'light'
  ) as UiTheme

  const choose = useCallback(async (next: UiTheme) => {
    applyTheme(next)
    window.dispatchEvent(new Event(THEME_EVENT))
    try {
      await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ui_theme: next }),
      })
    } catch {
      // The local choice stands even if the sync fails.
    }
  }, [])

  const btn = (value: UiTheme, label: string, Icon: typeof Sun) => (
    <button
      key={value}
      onClick={() => choose(value)}
      aria-pressed={theme === value}
      className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-[13px] font-bold transition-all duration-200 active:scale-[0.97] ${
        theme === value
          ? 'bg-white dark:bg-[#3A3A3C] text-[#1D1D1F] dark:text-white shadow-sm'
          : 'text-[#5A5A5E] dark:text-[#A1A1A6]'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  )

  return (
    <div
      className={`flex gap-1 p-1 rounded-full bg-black/[0.05] dark:bg-white/[0.08] ${
        compact ? 'w-full' : 'w-full max-w-[260px]'
      }`}
      role="group"
      aria-label="Theme"
    >
      {btn('light', 'Light', Sun)}
      {btn('dark', 'Dark', Moon)}
    </div>
  )
}
