import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkUsageAlert, detectWebhookType, buildWebhookPayload, sendWebhookAlert, checkAndNotify } from '../usageAlert'
import { Usage } from '../usage'
import { Storage } from '../storage'
import type { BudgetConfig } from '../../hooks/useConfig'

vi.mock('../usage', () => ({
  Usage: {
    getSummary: vi.fn(),
  },
}))

vi.mock('../storage', () => ({
  Storage: {
    get: vi.fn(),
    set: vi.fn(),
  },
}))

const mockGetSummary = vi.mocked(Usage.getSummary)
const mockStorageGet = vi.mocked(Storage.get)
const mockStorageSet = vi.mocked(Storage.set)

function budget(monthly: number, warn = 70, crit = 90): BudgetConfig {
  return { monthly, warnThreshold: warn, critThreshold: crit, webhookUrl: '', webhookEnabled: false }
}

describe('checkUsageAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('budget 0이면 none 반환', async () => {
    const result = await checkUsageAlert(budget(0))
    expect(result.level).toBe('none')
    expect(mockGetSummary).not.toHaveBeenCalled()
  })

  it('음수 budget이면 none 반환', async () => {
    const result = await checkUsageAlert(budget(-10))
    expect(result.level).toBe('none')
  })

  it('사용량이 경고 임계치 미만이면 none', async () => {
    mockGetSummary.mockResolvedValue({ totalCost: 5, totalTokens: 1000, totalRequests: 10, byProvider: {}, byFeature: {} })
    const result = await checkUsageAlert(budget(100, 70, 90))
    expect(result.level).toBe('none')
    expect(result.percentage).toBe(5)
    expect(result.remaining).toBe(95)
  })

  it('사용량이 경고 임계치 이상이면 warn', async () => {
    mockGetSummary.mockResolvedValue({ totalCost: 75, totalTokens: 1000, totalRequests: 10, byProvider: {}, byFeature: {} })
    const result = await checkUsageAlert(budget(100, 70, 90))
    expect(result.level).toBe('warn')
    expect(result.percentage).toBe(75)
    expect(result.remaining).toBe(25)
  })

  it('사용량이 위험 임계치 이상이면 critical', async () => {
    mockGetSummary.mockResolvedValue({ totalCost: 95, totalTokens: 1000, totalRequests: 10, byProvider: {}, byFeature: {} })
    const result = await checkUsageAlert(budget(100, 70, 90))
    expect(result.level).toBe('critical')
    expect(result.percentage).toBe(95)
    expect(result.remaining).toBe(5)
  })

  it('100% 초과 시 remaining은 0', async () => {
    mockGetSummary.mockResolvedValue({ totalCost: 120, totalTokens: 1000, totalRequests: 10, byProvider: {}, byFeature: {} })
    const result = await checkUsageAlert(budget(100, 70, 90))
    expect(result.level).toBe('critical')
    expect(result.percentage).toBe(120)
    expect(result.remaining).toBe(0)
  })

  it('정확히 경고 임계치에서 warn', async () => {
    mockGetSummary.mockResolvedValue({ totalCost: 70, totalTokens: 1000, totalRequests: 10, byProvider: {}, byFeature: {} })
    const result = await checkUsageAlert(budget(100, 70, 90))
    expect(result.level).toBe('warn')
  })

  it('정확히 위험 임계치에서 critical', async () => {
    mockGetSummary.mockResolvedValue({ totalCost: 90, totalTokens: 1000, totalRequests: 10, byProvider: {}, byFeature: {} })
    const result = await checkUsageAlert(budget(100, 70, 90))
    expect(result.level).toBe('critical')
  })

  it('커스텀 임계치 적용', async () => {
    mockGetSummary.mockResolvedValue({ totalCost: 55, totalTokens: 1000, totalRequests: 10, byProvider: {}, byFeature: {} })
    const result = await checkUsageAlert(budget(100, 50, 80))
    expect(result.level).toBe('warn')
  })

  it('반환 객체 구조 검증', async () => {
    mockGetSummary.mockResolvedValue({ totalCost: 42, totalTokens: 1000, totalRequests: 10, byProvider: {}, byFeature: {} })
    const result = await checkUsageAlert(budget(100))
    expect(result).toEqual({
      level: 'none',
      currentCost: 42,
      budget: 100,
      percentage: 42,
      remaining: 58,
    })
  })

  it('30일 기간으로 getSummary 호출', async () => {
    mockGetSummary.mockResolvedValue({ totalCost: 0, totalTokens: 0, totalRequests: 0, byProvider: {}, byFeature: {} })
    await checkUsageAlert(budget(50))
    expect(mockGetSummary).toHaveBeenCalledWith(30)
  })
})

describe('detectWebhookType', () => {
  it('Slack URL 감지', () => {
    expect(detectWebhookType('https://hooks.slack.com/services/T00/B00/xxx')).toBe('slack')
  })

  it('Discord URL 감지', () => {
    expect(detectWebhookType('https://discord.com/api/webhooks/123/abc')).toBe('discord')
  })

  it('일반 URL은 generic', () => {
    expect(detectWebhookType('https://example.com/webhook')).toBe('generic')
  })
})

describe('buildWebhookPayload', () => {
  const warnAlert = { level: 'warn' as const, currentCost: 75, budget: 100, percentage: 75, remaining: 25 }
  const critAlert = { level: 'critical' as const, currentCost: 95, budget: 100, percentage: 95, remaining: 5 }

  it('Slack 페이로드 생성', () => {
    const payload = buildWebhookPayload('slack', warnAlert)
    expect(payload.text).toContain('WARNING')
    expect(payload.blocks).toBeDefined()
  })

  it('Discord 페이로드 생성', () => {
    const payload = buildWebhookPayload('discord', critAlert)
    expect(payload.embeds).toBeDefined()
    const embeds = payload.embeds as Array<{ color: number }>
    expect(embeds[0].color).toBe(0xFF4444)
  })

  it('Generic 페이로드 생성', () => {
    const payload = buildWebhookPayload('generic', warnAlert)
    expect(payload.event).toBe('usage_alert')
    expect(payload.level).toBe('warn')
    expect(payload.currentCost).toBe(75)
  })
})

describe('sendWebhookAlert', () => {
  const warnAlert = { level: 'warn' as const, currentCost: 75, budget: 100, percentage: 75, remaining: 25 }

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({ ok: true })
    mockStorageGet.mockResolvedValue(null)
    mockStorageSet.mockResolvedValue(undefined)
  })

  it('URL 없으면 전송하지 않음', async () => {
    const result = await sendWebhookAlert('', warnAlert)
    expect(result).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('level이 none이면 전송하지 않음', async () => {
    const noneAlert = { level: 'none' as const, currentCost: 5, budget: 100, percentage: 5, remaining: 95 }
    const result = await sendWebhookAlert('https://hooks.slack.com/x', noneAlert)
    expect(result).toBe(false)
  })

  it('정상 전송 시 true 반환 및 중복 방지 저장', async () => {
    const result = await sendWebhookAlert('https://hooks.slack.com/x', warnAlert)
    expect(result).toBe(true)
    expect(fetch).toHaveBeenCalledWith('https://hooks.slack.com/x', expect.objectContaining({ method: 'POST' }))
    expect(mockStorageSet).toHaveBeenCalled()
  })

  it('같은 날 같은 레벨은 중복 전송 방지', async () => {
    const today = new Date().toISOString().slice(0, 10)
    mockStorageGet.mockResolvedValue({ date: today, level: 'warn' })
    const result = await sendWebhookAlert('https://hooks.slack.com/x', warnAlert)
    expect(result).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('다른 날이면 다시 전송', async () => {
    mockStorageGet.mockResolvedValue({ date: '2020-01-01', level: 'warn' })
    const result = await sendWebhookAlert('https://hooks.slack.com/x', warnAlert)
    expect(result).toBe(true)
  })

  it('fetch 실패 시 false 반환', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network error'))
    const result = await sendWebhookAlert('https://example.com/hook', warnAlert)
    expect(result).toBe(false)
  })
})

describe('checkAndNotify', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorageGet.mockResolvedValue(null)
    mockStorageSet.mockResolvedValue(undefined)
    global.fetch = vi.fn().mockResolvedValue({ ok: true })
  })

  it('webhook 비활성화 시 알림 미전송', async () => {
    mockGetSummary.mockResolvedValue({ totalCost: 80, totalTokens: 1000, totalRequests: 10, byProvider: {}, byFeature: {} })
    const b = { ...budget(100), webhookUrl: 'https://hooks.slack.com/x', webhookEnabled: false }
    const result = await checkAndNotify(b)
    expect(result.level).toBe('warn')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('webhook 활성화 + 임계치 초과 시 알림 전송', async () => {
    mockGetSummary.mockResolvedValue({ totalCost: 80, totalTokens: 1000, totalRequests: 10, byProvider: {}, byFeature: {} })
    const b = { ...budget(100), webhookUrl: 'https://hooks.slack.com/x', webhookEnabled: true }
    await checkAndNotify(b)
    expect(fetch).toHaveBeenCalled()
  })
})
