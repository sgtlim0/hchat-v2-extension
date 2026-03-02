// lib/usageAlert.ts — Usage threshold alert logic

import { Usage } from './usage'
import type { BudgetConfig } from '../hooks/useConfig'

export interface UsageAlertState {
  level: 'none' | 'warn' | 'critical'
  currentCost: number
  budget: number
  percentage: number
  remaining: number
}

const NONE_STATE: UsageAlertState = {
  level: 'none',
  currentCost: 0,
  budget: 0,
  percentage: 0,
  remaining: 0,
}

export async function checkUsageAlert(budget: BudgetConfig): Promise<UsageAlertState> {
  if (!budget.monthly || budget.monthly <= 0) return NONE_STATE

  const summary = await Usage.getSummary(30)
  const currentCost = summary.totalCost
  const percentage = (currentCost / budget.monthly) * 100
  const remaining = Math.max(0, budget.monthly - currentCost)

  const level: UsageAlertState['level'] =
    percentage >= budget.critThreshold ? 'critical' :
    percentage >= budget.warnThreshold ? 'warn' : 'none'

  return { level, currentCost, budget: budget.monthly, percentage, remaining }
}
