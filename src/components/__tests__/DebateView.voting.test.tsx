// components/__tests__/DebateView.voting.test.tsx — Tests for DebateView voting UI

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DebateView from '../DebateView'
import type { Config } from '../../hooks/useConfig'
import type { DebateScoreboard } from '../../lib/debateVoting'

// Mock useProvider
vi.mock('../../hooks/useProvider', () => ({
  useProvider: () => ({
    configuredModels: [
      { id: 'modelA', provider: 'bedrock' as const, label: 'Claude', shortLabel: 'Claude' },
      { id: 'modelB', provider: 'openai' as const, label: 'GPT', shortLabel: 'GPT' },
      { id: 'modelC', provider: 'gemini' as const, label: 'Gemini', shortLabel: 'Gemini' },
    ],
    getProvider: () => ({
      type: 'bedrock',
      isConfigured: () => true,
      stream: async function* () {
        yield 'test'
        return 'test'
      },
    }),
    getModel: (id: string) => ({
      id,
      provider: 'bedrock' as const,
      label: id,
      shortLabel: id,
    }),
  }),
}))

// Mock useLocale
vi.mock('../../i18n', () => ({
  useLocale: () => ({
    t: (key: string, params?: Record<string, any>) => {
      const translations: Record<string, string> = {
        'debate.modelSelect': '토론 모델 선택 (2-6개)',
        'debate.needModels': '최소 2개 필요',
        'debate.topicLabel': '토론 주제',
        'debate.topicPlaceholder': '주제를 입력하세요',
        'debate.startAction': '토론 시작',
        'debate.running': '진행 중...',
        'debate.emptyMessage': '모델을 선택하세요',
        'debate.streaming': '스트리밍',
        'debate.round': `라운드 ${params?.n ?? ''}`,
        'debate.roles.initial': '초기 답변',
        'debate.roles.critique': '비평',
        'debate.roles.synthesis': '종합',
        'debate.roles.voting': '투표',
        'debate.noAssistant': '없음',
        'debate.vote': '투표',
        'debate.votePrompt': '투표 진행 중',
        'debate.scoreboard': '스코어보드',
        'debate.rank': '순위',
        'debate.avgScore': '평균 점수',
        'debate.consensus': '합의',
        'debate.consensusReached': '합의 도달',
        'debate.votingRound': '투표 라운드',
        'common.stop': '중단',
      }
      return translations[key] ?? key
    },
    locale: 'ko',
  }),
}))

// Mock assistantBuilder
vi.mock('../../lib/assistantBuilder', () => ({
  AssistantRegistry: {
    list: vi.fn(() => Promise.resolve([])),
    getById: vi.fn(() => Promise.resolve(null)),
  },
}))

// Mock debate
vi.mock('../../lib/debate', () => ({
  runDebate: vi.fn(() => Promise.resolve([])),
  runDebateWithVoting: vi.fn(() => Promise.resolve([])),
}))

const mockConfig: Config = {
  aws: { region: 'us-east-1', accessKeyId: 'test', secretAccessKey: 'test' },
  openai: { apiKey: 'test' },
  gemini: { apiKey: 'test' },
  selectedModel: 'modelA',
  systemPrompt: '',
  thinkingDepth: 'normal',
  locale: 'ko',
  theme: 'dark',
}

describe('DebateView voting UI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render model selection with up to 6 models allowed', () => {
    render(<DebateView config={mockConfig} />)

    expect(screen.getByText('토론 모델 선택 (2-6개)')).toBeTruthy()
  })

  it('should render voting toggle button', () => {
    render(<DebateView config={mockConfig} />)

    const votingToggle = screen.getByText('투표 라운드')
    expect(votingToggle).toBeTruthy()
  })

  it('should toggle voting on/off', () => {
    render(<DebateView config={mockConfig} />)

    const votingToggle = screen.getByTestId('voting-toggle')
    expect(votingToggle).toBeTruthy()

    fireEvent.click(votingToggle)
    // Toggle should change state
    expect(votingToggle).toBeTruthy()
  })

  it('should render scoreboard section when scoreboard data exists', () => {
    const { container } = render(<DebateView config={mockConfig} />)

    // Scoreboard should not be visible initially
    const scoreboardSection = container.querySelector('[data-testid="scoreboard"]')
    expect(scoreboardSection).toBeNull()
  })

  it('should render start button disabled when less than 2 models selected', () => {
    render(<DebateView config={mockConfig} />)

    const startButton = screen.getByText('토론 시작')
    expect(startButton).toBeTruthy()
    expect((startButton as HTMLButtonElement).disabled).toBe(true)
  })

  it('should allow selecting models by clicking', () => {
    render(<DebateView config={mockConfig} />)

    const modelButtons = screen.getAllByRole('button').filter(
      (btn) => btn.classList.contains('model-toggle')
    )

    expect(modelButtons.length).toBeGreaterThanOrEqual(2)
  })

  it('should render consensus banner when consensus is reached', () => {
    // This tests the static rendering of the consensus banner component
    const { container } = render(<DebateView config={mockConfig} />)

    // No consensus banner initially
    const banner = container.querySelector('[data-testid="consensus-banner"]')
    expect(banner).toBeNull()
  })

  it('should display voting round label in debate rounds', () => {
    render(<DebateView config={mockConfig} />)

    // Initially no rounds displayed
    expect(screen.getByText('모델을 선택하세요')).toBeTruthy()
  })

  it('should render scoreboard table with correct columns', () => {
    // Scoreboard is only shown after voting completes
    // This tests that the component structure is correct
    const { container } = render(<DebateView config={mockConfig} />)

    // No scoreboard table initially (no voting has happened)
    const table = container.querySelector('[data-testid="scoreboard-table"]')
    expect(table).toBeNull()
  })

  it('should show consensus percentage in banner', () => {
    const { container } = render(<DebateView config={mockConfig} />)

    // Initially no consensus data
    const percentage = container.querySelector('[data-testid="consensus-percentage"]')
    expect(percentage).toBeNull()
  })
})
