import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type LanguageCode = 'en' | 'hi' | 'kn'

interface LanguageState {
  language: LanguageCode
  setLanguage: (lang: LanguageCode) => void
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: 'en',
      setLanguage: (lang) => set({ language: lang }),
    }),
    {
      name: 'billdost-language',
    }
  )
)
