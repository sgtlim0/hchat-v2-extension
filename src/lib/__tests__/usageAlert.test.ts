import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkUsageAlert } from '../usageAlert'
import { Usage } from '../usage'
import type { BudgetConfig } from '../../hooks/useConfig'

vi.mock('../usage', () => ({
  Usage: {
    getSummary: vi.fn(),
  },
}))

const mockGetSummary = vi.mocked(Usage.getSummary)

function budget(monthly: number, warn = 70, crit = 90): BudgetConfig {
  return { monthly, warnThreshold: warn, critThreshold: crit }
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
