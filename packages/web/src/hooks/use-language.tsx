"use client"

import { useState, useEffect, createContext, useContext } from 'react'
import { translations } from '@/lib/translations'

type Language = 'es' | 'en'

interface LanguageContextType {
  language: Language
  changeLanguage: (newLanguage: Language) => void
  t: (key: string) => string
  tNested: (path: string) => any
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('es')

  useEffect(() => {
    // Load language from localStorage on mount
    const savedLanguage = localStorage.getItem('language') as Language
    if (savedLanguage && (savedLanguage === 'es' || savedLanguage === 'en')) {
      setLanguage(savedLanguage)
    }
  }, [])

  const changeLanguage = (newLanguage: Language) => {
    setLanguage(newLanguage)
    localStorage.setItem('language', newLanguage)
    // Update HTML lang attribute
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLanguage
    }
  }

  // Simple translation function for direct keys
  const t = (key: string): string => {
    const currentTranslations = translations[language] || translations.es
    return key.split('.').reduce((obj, key) => obj?.[key], currentTranslations) || key
  }

  // Nested translation function for complex objects
  const tNested = (path: string): any => {
    const currentTranslations = translations[language] || translations.es
    return path.split('.').reduce((obj, key) => obj?.[key], currentTranslations) || {}
  }

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t, tNested }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
} 