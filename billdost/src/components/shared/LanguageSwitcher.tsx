'use client'

import { Globe } from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc/client'
import { useLanguageStore, type LanguageCode } from '@/lib/store/language'
import { LANGUAGE_OPTIONS } from '@/lib/i18n/language'

/**
 * Language switcher used in the sidebar (desktop) and in Settings
 * (reachable on mobile). Changing it writes the shop record, which is
 * the source of truth LanguageSync reads back on every load.
 */
export function LanguageSwitcher({ id = 'language-switcher' }: { id?: string }) {
  const language = useLanguageStore((s) => s.language)
  const setLanguage = useLanguageStore((s) => s.setLanguage)
  const updateLanguage = trpc.settings.updateLanguage.useMutation({
    onError: (err) => toast.error(err.message),
  })

  const handleChange = (code: LanguageCode) => {
    setLanguage(code) // instant UI feedback; shop record is written below
    updateLanguage.mutate({ language: code })
  }

  return (
    <div className="flex items-center gap-2">
      <Globe className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
      <label htmlFor={id} className="sr-only">
        App language
      </label>
      <select
        id={id}
        value={language}
        onChange={(e) => handleChange(e.target.value as LanguageCode)}
        className="bg-transparent text-sm font-bold text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer min-h-[44px]"
      >
        {LANGUAGE_OPTIONS.map((opt) => (
          <option key={opt.code} value={opt.code}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
