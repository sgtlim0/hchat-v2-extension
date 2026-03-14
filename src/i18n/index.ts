// i18n — Lightweight internationalization for H Chat

import { useState, useEffect, useCallback, useMemo } from 'react'
import ko from './ko'
import en from './en'
import ja from './ja'
import { SK } from '../lib/storageKeys'

export type Locale = 'ko' | 'en' | 'ja'

type Translations = typeof ko

const translations: Record<Locale, Translations> = { ko, en, ja }

let currentLocale: Locale = 'ko'

function getNestedValue(obj: unknown, path: string): string | undefined {
  const keys = path.split('.')
  let current: unknown = obj
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return typeof current === 'string' ? current : undefined
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    params[key] != null ? String(params[key]) : `{${key}}`,
  )
}

/** Synchronous translate function. Uses the current global locale. */
export function t(key: string, params?: Record<string, string | number>): string {
  const value = getNestedValue(translations[currentLocale], key)
    ?? getNestedValue(translations.ko, key) // fallback to Korean
    ?? key
  return interpolate(value, params)
}

/** Synchronous translate with explicit locale (for content scripts). */
export function tSync(locale: Locale, key: string, params?: Record<string, string | number>): string {
  const value = getNestedValue(translations[locale], key)
    ?? getNestedValue(translations.ko, key)
    ?? key
  return interpolate(value, params)
}

/** Get locale from chrome.storage (for content scripts that can't use React hooks). */
export async function getLocale(): Promise<Locale> {
  try {
    const result = await chrome.storage.local.get(SK.CONFIG)
    const lang = result[SK.CONFIG]?.language
    if (lang === 'en') return 'en'
    if (lang === 'ja') return 'ja'
    return 'ko'
  } catch {
    return 'ko'
  }
}

/** Set the global locale (used internally by useLocale). */
export function setGlobalLocale(locale: Locale): void {
  currentLocale = locale
}

/** Get current global locale. */
export function getGlobalLocale(): Locale {
  return currentLocale
}

/** React hook that provides locale-aware translation. */
export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>(currentLocale)

  // Sync with config's language on mount
  useEffect(() => {
    chrome.storage.local.get(SK.CONFIG, (result) => {
      const lang = result[SK.CONFIG]?.language
      let resolved: Locale = 'ko'
      if (lang === 'en') resolved = 'en'
      else if (lang === 'ja') resolved = 'ja'
      currentLocale = resolved
      setLocaleState(resolved)
    })

    // Listen for config changes (language switch)
    const handler = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes[SK.CONFIG]) {
        const lang = changes[SK.CONFIG].newValue?.language
        let resolved: Locale = 'ko'
        if (lang === 'en') resolved = 'en'
        else if (lang === 'ja') resolved = 'ja'
        currentLocale = resolved
        setLocaleState(resolved)
      }
    }
    chrome.storage.local.onChanged.addListener(handler)
    return () => chrome.storage.local.onChanged.removeListener(handler)
  }, [])

  const setLocale = useCallback((newLocale: Locale) => {
    currentLocale = newLocale
    setLocaleState(newLocale)
  }, [])

  const tFn = useMemo(() => {
    return (key: string, params?: Record<string, string | number>): string => {
      const value = getNestedValue(translations[locale], key)
        ?? getNestedValue(translations.ko, key)
        ?? key
      return interpolate(value, params)
    }
  }, [locale])

  return { t: tFn, locale, setLocale }
}
