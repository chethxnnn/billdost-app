'use client'

import { useEffect } from 'react'
import { useLanguageStore } from '@/lib/store/language'
import { normalizeShopLanguage } from '@/lib/i18n/language'

/**
 * Syncs the render language from the shop record on every dashboard
 * load. Before this, onboarding wrote the choice to the shop while the
 * app read a separate browser store that defaulted to English, so the
 * step where the user picked a language was silently ignored.
 */
export function LanguageSync({ shopLanguage }: { shopLanguage: string | null | undefined }) {
  const language = useLanguageStore((s) => s.language)
  const setLanguage = useLanguageStore((s) => s.setLanguage)

  useEffect(() => {
    const fromShop = normalizeShopLanguage(shopLanguage)
    if (fromShop !== language) setLanguage(fromShop)
  }, [shopLanguage, language, setLanguage])

  return null
}
