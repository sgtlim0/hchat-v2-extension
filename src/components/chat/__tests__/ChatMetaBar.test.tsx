import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock child components to isolate ChatMetaBar behavior
vi.mock('../../ModelSelector', () => ({
  ModelSelector: vi.fn(({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div data-testid="model-selector">{value}</div>
  )),
}))

vi.mock('../../AssistantSelector', () => ({
  AssistantSelector: vi.fn(({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div data-testid="assistant-selector">{value}</div>
  )),
}))

vi.mock('../ThinkingDepthSelector', () => ({
  ThinkingDepthSelector: vi.fn(({ depth }: { depth: string }) => (
    <div data-testid="thinking-depth">{depth}</div>
  )),
}))

vi.mock('../DeepResearchToggle', () => ({
  DeepResearchToggle: vi.fn(({ enabled }: { enabled: boolean }) => (
    <div data-testid="deep-research">{enabled ? 'on' : 'off'}</div>
  )),
}))

import { ChatMetaBar } from '../ChatMetaBar'
import type { Config } from '../../../hooks/useConfig'
import type { ThinkingDepth } from '../../../lib/providers/types'

const mockConfig: Config = {
  aws: { accessKeyId: '', secretAccessKey: '', region: 'us-east-1' },
  openai: { apiKey: '' },
  gemini: { apiKey: '' },
  ollama: { baseUrl: '', modelFilter: [] },
  openrouter: { apiKey: '', siteUrl: '', siteName: '' },
  defaultModel: 'us.anthropic.claude-sonnet-4-6',
  autoRouting: false,
  theme: 'system',
  language: 'ko',
  enableContentScript: true,
  enableSearchEnhance: true,
  enableWebSearch: true,
  googleSearchApiKey: '',
  googleSearchEngineId: '',
  budget: { monthly: 0, warnThreshold: 70, critThreshold: 90, webhookUrl: '', webhookEnabled: false },
}

function makeProps(overrides: Partial<React.ComponentProps<typeof ChatMetaBar>> = {}) {
  return {
    currentModel: 'us.anthropic.claude-sonnet-4-6',
    onModelChange: vi.fn(),
    config: mockConfig,
    thinkingDepth: 'none' as ThinkingDepth,
    onThinkingDepthChange: vi.fn(),
    assistantId: 'default',
    onAssistantChange: vi.fn(),
    deepResearch: false,
    onToggleDeepResearch: vi.fn(),
    researchProgress: null,
    researchSources: [],
    streamingReport: '',
    agentMode: false,
    voiceMode: false,
    t: (key: string) => {
      const map: Record<string, string> = {
        'chat.agentMode': '에이전트 모드',
        'chat.voiceModeBadge': '음성 모드',
        'chat.promptHint': 'Ctrl+Enter로 전송',
      }
      return map[key] ?? key
    },
    ...overrides,
  }
}

describe('ChatMetaBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders ModelSelector with current model', () => {
    render(<ChatMetaBar {...makeProps()} />)
    expect(screen.getByTestId('model-selector').textContent).toBe('us.anthropic.claude-sonnet-4-6')
  })

  it('renders AssistantSelector with current assistant', () => {
    render(<ChatMetaBar {...makeProps({ assistantId: 'code-reviewer' })} />)
    expect(screen.getByTestId('assistant-selector').textContent).toBe('code-reviewer')
  })

  it('renders ThinkingDepthSelector', () => {
    render(<ChatMetaBar {...makeProps({ thinkingDepth: 'extended' as ThinkingDepth })} />)
    expect(screen.getByTestId('thinking-depth').textContent).toBe('extended')
  })

  it('renders DeepResearchToggle', () => {
    render(<ChatMetaBar {...makeProps({ deepResearch: true })} />)
    expect(screen.getByTestId('deep-research').textContent).toBe('on')
  })

  it('shows agent mode badge when agentMode is true', () => {
    render(<ChatMetaBar {...makeProps({ agentMode: true })} />)
    expect(screen.getByText(/에이전트 모드/)).toBeTruthy()
  })

  it('hides agent mode badge when agentMode is false', () => {
    render(<ChatMetaBar {...makeProps({ agentMode: false })} />)
    expect(screen.queryByText(/에이전트 모드/)).toBeNull()
  })

  it('shows voice mode badge when voiceMode is true', () => {
    render(<ChatMetaBar {...makeProps({ voiceMode: true })} />)
    expect(screen.getByText(/음성 모드/)).toBeTruthy()
  })

  it('hides voice mode badge when voiceMode is false', () => {
    render(<ChatMetaBar {...makeProps({ voiceMode: false })} />)
    expect(screen.queryByText(/음성 모드/)).toBeNull()
  })

  it('shows both agent and voice badges simultaneously', () => {
    render(<ChatMetaBar {...makeProps({ agentMode: true, voiceMode: true })} />)
    expect(screen.getByText(/에이전트 모드/)).toBeTruthy()
    expect(screen.getByText(/음성 모드/)).toBeTruthy()
  })

  it('renders prompt hint text', () => {
    render(<ChatMetaBar {...makeProps()} />)
    expect(screen.getByText('Ctrl+Enter로 전송')).toBeTruthy()
  })

  it('renders correct container class', () => {
    const { container } = render(<ChatMetaBar {...makeProps()} />)
    expect(container.querySelector('.input-meta')).toBeTruthy()
  })
})
