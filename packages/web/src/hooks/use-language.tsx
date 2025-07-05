"use client"

import { useState, useEffect } from 'react'

export function useLanguage() {
  const [language, setLanguage] = useState('es')

  useEffect(() => {
    // Load language from localStorage on mount
    const savedLanguage = localStorage.getItem('language')
    if (savedLanguage) {
      setLanguage(savedLanguage)
    }
  }, [])

  const changeLanguage = (newLanguage: string) => {
    setLanguage(newLanguage)
    localStorage.setItem('language', newLanguage)
  }

  return { language, changeLanguage }
} 