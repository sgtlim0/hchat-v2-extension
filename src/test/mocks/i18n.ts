import { vi } from 'vitest'

/** Mock t() — returns the key as-is (or with interpolation). */
export const mockT = vi.fn((key: string, params?: Record<string, string | number>) => {
  if (!params) return key
  return key.replace(/\{(\w+)\}/g, (_, k) => (params[k] != null ? String(params[k]) : `{${k}}`))
})

export const mockGetGlobalLocale = vi.fn(() => 'ko' as const)
export const mockSetGlobalLocale = vi.fn()
export const mockTSync = vi.fn(
  (_locale: string, key: string, params?: Record<string, string | number>) => {
    if (!params) return key
    return key.replace(/\{(\w+)\}/g, (_, k) => (params[k] != null ? String(params[k]) : `{${k}}`))
  },
)

/** Call vi.mock('@/i18n', ...) or use this factory with the actual path. */
export function setupI18nMock() {
  return {
    t: mockT,
    tSync: mockTSync,
    getGlobalLocale: mockGetGlobalLocale,
    setGlobalLocale: mockSetGlobalLocale,
    getLocale: vi.fn(() => Promise.resolve('ko' as const)),
    useLocale: vi.fn(() => ({ t: mockT, locale: 'ko' as const, setLocale: vi.fn() })),
  }
}
