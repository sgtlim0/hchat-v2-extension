import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'

// Mock analyticsEngine
vi.mock('../../lib/analyticsEngine', () => ({
  aggregateConversations: vi.fn().mockReturnValue({
    totalConversations: 50,
    totalMessages: 500,
    byModel: {},
    byProvider: { bedrock: 30, openai: 20 },
    avgMessagesPerConv: 10,
  }),
  extractTopics: vi.fn().mockReturnValue([
    { word: 'AI', score: 5.2 },
    { word: '번역', score: 3.1 },
  ]),
  getDailyActivity: vi.fn().mockReturnValue([
    { date: '2026-03-06', conversations: 5, messages: 50 },
  ]),
  getHourlyHeatmap: vi.fn().mockReturnValue(
    new Array(24).fill(0).map((_, i) => (i === 14 ? 10 : 1)),
  ),
  compareProviders: vi.fn().mockReturnValue([
    { provider: 'bedrock', count: 30, avgResponseLength: 500, peakHour: 14 },
  ]),
}))

// Mock chatHistory
vi.mock('../../lib/chatHistory', () => ({
  ChatHistory: {
    listIndex: vi.fn().mockResolvedValue([
      {
        id: '1',
        title: 'Test',
        model: 'sonnet',
        messageCount: 10,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]),
  },
}))

// Mock i18n
vi.mock('../../i18n', () => ({
  useLocale: () => ({
    t: (key: string) => key,
    locale: 'ko' as const,
    setLocale: vi.fn(),
  }),
}))

import { ConversationAnalytics } from '../ConversationAnalytics'
import { ChatHistory } from '../../lib/chatHistory'
import {
  aggregateConversations,
  extractTopics,
  getDailyActivity,
  getHourlyHeatmap,
  compareProviders,
} from '../../lib/analyticsEngine'

describe('ConversationAnalytics', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Restore default mocks after clearAllMocks
    vi.mocked(ChatHistory.listIndex).mockResolvedValue([
      {
        id: '1',
        title: 'Test',
        model: 'sonnet',
        updatedAt: Date.now(),
        pinned: false,
        tags: [],
        folderId: undefined,
      },
    ])
    vi.mocked(aggregateConversations).mockReturnValue({
      totalConversations: 50,
      totalMessages: 500,
      byModel: {},
      byProvider: { bedrock: 30, openai: 20 },
      avgMessagesPerConv: 10,
    })
    vi.mocked(extractTopics).mockReturnValue([
      { word: 'AI', score: 5.2 },
      { word: '번역', score: 3.1 },
    ])
    vi.mocked(getDailyActivity).mockReturnValue([
      { date: '2026-03-06', conversations: 5, messages: 50 },
    ])
    vi.mocked(getHourlyHeatmap).mockReturnValue(
      new Array(24).fill(0).map((_, i) => (i === 14 ? 10 : 1)),
    )
    vi.mocked(compareProviders).mockReturnValue([
      { provider: 'bedrock', count: 30, avgResponseLength: 500, peakHour: 14 },
    ])
  })

  it('renders loading state initially', () => {
    // Make listIndex never resolve to keep loading state
    vi.mocked(ChatHistory.listIndex).mockReturnValue(new Promise(() => {}))
    render(<ConversationAnalytics onClose={mockOnClose} />)
    expect(screen.getByText('common.loading')).toBeInTheDocument()
  })

  it('renders title after loading', async () => {
    render(<ConversationAnalytics onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('analytics.title')).toBeInTheDocument()
    })
  })

  it('calls ChatHistory.listIndex on mount', async () => {
    render(<ConversationAnalytics onClose={mockOnClose} />)
    await waitFor(() => {
      expect(ChatHistory.listIndex).toHaveBeenCalled()
    })
  })

  it('displays summary cards with aggregate data', async () => {
    render(<ConversationAnalytics onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('analytics.totalConversations')).toBeInTheDocument()
      expect(screen.getByText('analytics.totalMessages')).toBeInTheDocument()
      expect(screen.getByText('analytics.avgMessages')).toBeInTheDocument()
    })
    // Verify the numeric values exist (may appear multiple times)
    expect(screen.getAllByText('50').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('500').length).toBeGreaterThanOrEqual(1)
  })

  it('displays provider comparison list', async () => {
    render(<ConversationAnalytics onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('analytics.providerComparison')).toBeInTheDocument()
      expect(screen.getByText('bedrock')).toBeInTheDocument()
    })
    // Provider count shown in combined text
    expect(screen.getByText(/30 analytics\.conversations/)).toBeInTheDocument()
  })

  it('displays topic keywords', async () => {
    render(<ConversationAnalytics onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('analytics.topTopics')).toBeInTheDocument()
      expect(screen.getByText('AI')).toBeInTheDocument()
      expect(screen.getByText('번역')).toBeInTheDocument()
    })
  })

  it('displays daily activity bars', async () => {
    render(<ConversationAnalytics onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('analytics.dailyActivity')).toBeInTheDocument()
      expect(screen.getByText('03-06')).toBeInTheDocument()
    })
  })

  it('displays hourly heatmap grid', async () => {
    render(<ConversationAnalytics onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('analytics.hourlyHeatmap')).toBeInTheDocument()
    })
    // 24 cells should be rendered
    const heatmapCells = screen.getAllByTestId(/^heatmap-/)
    expect(heatmapCells).toHaveLength(24)
  })

  it('highlights peak hour cell with higher opacity', async () => {
    render(<ConversationAnalytics onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByTestId('heatmap-14')).toBeInTheDocument()
    })
    const peakCell = screen.getByTestId('heatmap-14')
    // Peak hour (14) has value 10, max is 10 => opacity should be 1
    expect(peakCell.style.opacity).toBe('1')
  })

  it('calls onClose when close button is clicked', async () => {
    render(<ConversationAnalytics onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('analytics.title')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('common.close'))
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('calls all analytics functions with conversations', async () => {
    render(<ConversationAnalytics onClose={mockOnClose} />)
    await waitFor(() => {
      expect(aggregateConversations).toHaveBeenCalled()
      expect(extractTopics).toHaveBeenCalled()
      expect(getDailyActivity).toHaveBeenCalled()
      expect(getHourlyHeatmap).toHaveBeenCalled()
      expect(compareProviders).toHaveBeenCalled()
    })
  })

  it('renders topic tags with font size proportional to score', async () => {
    render(<ConversationAnalytics onClose={mockOnClose} />)
    await waitFor(() => {
      expect(screen.getByText('AI')).toBeInTheDocument()
    })
    const aiTag = screen.getByText('AI')
    const translateTag = screen.getByText('번역')
    // AI has higher score, should have larger font size
    const aiFontSize = parseFloat(aiTag.style.fontSize)
    const translateFontSize = parseFloat(translateTag.style.fontSize)
    expect(aiFontSize).toBeGreaterThan(translateFontSize)
  })
})
