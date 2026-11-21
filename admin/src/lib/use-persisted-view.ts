'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * A two-way view preference (board/list, list/grid) persisted in
 * localStorage, read through useSyncExternalStore so the server
 * render and the first client render agree, and the stored choice
 * applies the moment hydration completes. Writes dispatch a local
 * event because the storage event does not fire in the same window.
 */
const EVENT = 'billdost-view-change'

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

export function usePersistedView<T extends string>(
  key: string,
  fallback: T,
  allowed: readonly T[]
): [T, (next: T) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => {
      try {
        const raw = localStorage.getItem(key)
        return raw && (allowed as readonly string[]).includes(raw) ? raw : fallback
      } catch {
        return fallback
      }
    },
    () => fallback
  ) as T

  const set = useCallback(
    (next: T) => {
      try {
        localStorage.setItem(key, next)
      } catch {
        // Private mode: the event below still applies it locally.
      }
      window.dispatchEvent(new Event(EVENT))
    },
    [key]
  )

  return [value, set]
}
