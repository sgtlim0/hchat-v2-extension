// lib/usageAlert.ts — Usage threshold alert logic with webhook notifications

import { Usage } from './usage'
import { Storage } from './storage'
import type { BudgetConfig } from '../hooks/useConfig'
import { SK } from './storageKeys'
import { safeFetch } from './safeFetch'

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

const LAST_ALERT_KEY = SK.LAST_WEBHOOK_ALERT

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

/** Detect webhook type from URL */
export function detectWebhookType(url: string): 'slack' | 'discord' | 'generic' {
  if (url.includes('hooks.slack.com')) return 'slack'
  if (url.includes('discord.com/api/webhooks')) return 'discord'
  return 'generic'
}

/** Build webhook payload based on type */
export function buildWebhookPayload(
  type: 'slack' | 'discord' | 'generic',
  alert: UsageAlertState,
): Record<string, unknown> {
  const emoji = alert.level === 'critical' ? '🚨' : '⚠️'
  const levelText = alert.level === 'critical' ? 'CRITICAL' : 'WARNING'
  const message = `${emoji} H Chat 사용량 ${levelText}: $${alert.currentCost.toFixed(2)} / $${alert.budget.toFixed(2)} (${alert.percentage.toFixed(1)}%) — 잔여: $${alert.remaining.toFixed(2)}`

  if (type === 'slack') {
    return {
      text: message,
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: message },
        },
      ],
    }
  }

  if (type === 'discord') {
    const color = alert.level === 'critical' ? 0xFF4444 : 0xFFAA00
    return {
      embeds: [{
        title: `${emoji} H Chat Usage ${levelText}`,
        description: message,
        color,
        fields: [
          { name: '현재 비용', value: `$${alert.currentCost.toFixed(2)}`, inline: true },
          { name: '월 예산', value: `$${alert.budget.toFixed(2)}`, inline: true },
          { name: '잔여', value: `$${alert.remaining.toFixed(2)}`, inline: true },
        ],
      }],
    }
  }

  // Generic webhook (JSON)
  return {
    event: 'usage_alert',
    level: alert.level,
    currentCost: alert.currentCost,
    budget: alert.budget,
    percentage: alert.percentage,
    remaining: alert.remaining,
    message,
  }
}

/** Send webhook notification (deduplicates by level per day) */
export async function sendWebhookAlert(
  webhookUrl: string,
  alert: UsageAlertState,
): Promise<boolean> {
  if (!webhookUrl || alert.level === 'none') return false

  // Deduplicate: only send once per level per day
  const today = new Date().toISOString().slice(0, 10)
  const lastAlert = await Storage.get<{ date: string; level: string }>(LAST_ALERT_KEY)
  if (lastAlert?.date === today && lastAlert?.level === alert.level) return false

  const type = detectWebhookType(webhookUrl)
  const payload = buildWebhookPayload(type, alert)

  try {
    const res = await safeFetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      await Storage.set(LAST_ALERT_KEY, { date: today, level: alert.level })
      return true
    }
    return false
  } catch {
    return false
  }
}

/** Check and send webhook alert if conditions are met */
export async function checkAndNotify(budget: BudgetConfig): Promise<UsageAlertState> {
  const alert = await checkUsageAlert(budget)

  if (budget.webhookEnabled && budget.webhookUrl && alert.level !== 'none') {
    sendWebhookAlert(budget.webhookUrl, alert).catch(() => {})
  }

  return alert
}
