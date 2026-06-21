import { useLanguageStore } from '../store/language'
import { dictionaries, DictionaryKey } from './dictionaries'

export function useTranslation() {
  const { language, setLanguage } = useLanguageStore()

  const t = (section: keyof DictionaryKey, key: string): string => {
    try {
      const dict = dictionaries[language]
      // Type assertion to allow dynamic string keys safely
      const sectionDict = dict[section] as Record<string, string>
      return sectionDict[key] || dictionaries.en[section]?.[key as keyof typeof dictionaries.en[typeof section]] || key
    } catch (e) {
      return key
    }
  }

  return { t, language, setLanguage }
}
