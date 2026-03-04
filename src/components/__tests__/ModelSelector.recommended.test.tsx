import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ModelSelector } from '../ModelSelector'
import type { Config } from '../../hooks/useConfig'

const mockGetTopUsed = vi.fn()

vi.mock('../../lib/userPreferences', () => ({
  getTopUsed: (...args: unknown[]) => mockGetTopUsed(...args),
}))

vi.mock('../../hooks/useProvider', () => ({
  useProvider: () => ({
    allModels: [
      { id: 'us.anthropic.claude-sonnet-4-6', label: 'Sonnet 4.6', shortLabel: 'Sonnet', emoji: '🟠', provider: 'bedrock' },
      { id: 'gpt-4o', label: 'GPT-4o', shortLabel: 'GPT-4o', emoji: '🟢', provider: 'openai' },
      { id: 'gemini-2.0-flash', label: 'Gemini Flash', shortLabel: 'Flash', emoji: '🔵', provider: 'gemini' },
    ],
    getProvider: () => ({ isConfigured: () => true }),
  }),
}))

vi.mock('../../i18n', () => ({
  useLocale: () => ({
    t: (key: string) => key,
  }),
}))

const DEFAULT_CONFIG = {
  aws: { region: 'us-east-1', accessKeyId: 'test', secretAccessKey: 'test' },
  openai: { apiKey: 'test' },
  gemini: { apiKey: 'test' },
  model: 'us.anthropic.claude-sonnet-4-6',
  autoRouting: false,
} as unknown as Config

function renderModelSelector(value = 'us.anthropic.claude-sonnet-4-6') {
  return render(
    <ModelSelector value={value} onChange={vi.fn()} config={DEFAULT_CONFIG} />,
  )
}

describe('ModelSelector recommended', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetTopUsed.mockResolvedValue([
      { id: 'us.anthropic.claude-sonnet-4-6', count: 10, lastUsed: Date.now() },
    ])
  })

  it('shows star badge for recommended model', async () => {
    renderModelSelector()
    // Open dropdown
    fireEvent.click(screen.getByText('Sonnet'))
    await waitFor(() => {
      const buttons = screen.getAllByRole('option')
      const sonnetBtn = buttons.find((b) => b.textContent?.includes('Sonnet 4.6'))
      expect(sonnetBtn?.textContent).toContain('⭐')
    })
  })

  it('no badge for non-recommended model', async () => {
    renderModelSelector()
    fireEvent.click(screen.getByText('Sonnet'))
    await waitFor(() => {
      const buttons = screen.getAllByRole('option')
      const gptBtn = buttons.find((b) => b.textContent?.includes('GPT-4o'))
      expect(gptBtn?.textContent).not.toContain('⭐')
    })
  })

  it('getTopUsed error does not crash component', async () => {
    mockGetTopUsed.mockRejectedValue(new Error('fail'))
    renderModelSelector()
    fireEvent.click(screen.getByText('Sonnet'))
    await waitFor(() => {
      expect(screen.getAllByRole('option').length).toBeGreaterThan(0)
    })
  })

  it('recommendations loaded on mount', async () => {
    renderModelSelector()
    await waitFor(() => {
      expect(mockGetTopUsed).toHaveBeenCalledWith('model', 3)
    })
  })

  it('multiple recommended models shown correctly', async () => {
    mockGetTopUsed.mockResolvedValue([
      { id: 'us.anthropic.claude-sonnet-4-6', count: 10, lastUsed: Date.now() },
      { id: 'gpt-4o', count: 5, lastUsed: Date.now() },
    ])
    renderModelSelector()
    fireEvent.click(screen.getByText('Sonnet'))
    await waitFor(() => {
      const buttons = screen.getAllByRole('option')
      const sonnetBtn = buttons.find((b) => b.textContent?.includes('Sonnet 4.6'))
      const gptBtn = buttons.find((b) => b.textContent?.includes('GPT-4o'))
      expect(sonnetBtn?.textContent).toContain('⭐')
      expect(gptBtn?.textContent).toContain('⭐')
    })
  })
})
