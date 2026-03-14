// lib/policyManager.ts — Policy management system for enforcing usage rules

import { Storage } from './storage'
import { SK } from './storageKeys'

const STORAGE_KEY = SK.POLICIES
const STATUS_KEY = SK.POLICY_STATUS
const MAX_POLICIES = 20

// ── Types ──

export type PolicyType =
  | 'model_whitelist'
  | 'tool_whitelist'
  | 'assistant_approval'
  | 'pii_enforcement'
  | 'budget_limit'

export interface Policy {
  id: string
  type: PolicyType
  name: string
  enabled: boolean
  config: Record<string, unknown>
  createdAt: number
}

export interface PolicyAction {
  type: 'use_model' | 'use_tool' | 'use_assistant' | 'send_message'
  target: string
  metadata?: Record<string, unknown>
}

export interface PolicyCheckResult {
  allowed: boolean
  violations: string[]
  enforcedBy?: string
}

export interface PolicyStatus {
  activePolicies: number
  totalViolations: number
  lastCheckAt: number
}

// ── Internal helpers ──

async function loadPolicies(): Promise<Policy[]> {
  return (await Storage.get<Policy[]>(STORAGE_KEY)) ?? []
}

async function persistPolicies(policies: Policy[]): Promise<void> {
  await Storage.set(STORAGE_KEY, policies)
}

async function loadStatus(): Promise<PolicyStatus> {
  return (
    (await Storage.get<PolicyStatus>(STATUS_KEY)) ?? {
      activePolicies: 0,
      totalViolations: 0,
      lastCheckAt: 0,
    }
  )
}

async function persistStatus(status: PolicyStatus): Promise<void> {
  await Storage.set(STATUS_KEY, status)
}

// ── Policy checkers ──

function checkModelWhitelist(
  policy: Policy,
  action: PolicyAction,
): string | null {
  if (action.type !== 'use_model') return null
  const models = (policy.config.models as string[]) ?? []
  if (!models.includes(action.target)) {
    return `모델 '${action.target}'은(는) 허용 목록에 없습니다`
  }
  return null
}

function checkToolWhitelist(
  policy: Policy,
  action: PolicyAction,
): string | null {
  if (action.type !== 'use_tool') return null
  const tools = (policy.config.tools as string[]) ?? []
  if (!tools.includes(action.target)) {
    return `도구 '${action.target}'은(는) 허용 목록에 없습니다`
  }
  return null
}

function checkAssistantApproval(
  policy: Policy,
  action: PolicyAction,
): string | null {
  if (action.type !== 'use_assistant') return null
  const approved = (policy.config.approvedAssistants as string[]) ?? []
  if (!approved.includes(action.target)) {
    return `비서 '${action.target}'은(는) 승인되지 않았습니다`
  }
  return null
}

function checkPiiEnforcement(
  policy: Policy,
  action: PolicyAction,
): string | null {
  if (action.type !== 'send_message') return null
  const enforced = policy.config.enforced as boolean
  if (!enforced) return null
  const piiDetected = action.metadata?.piiDetected as boolean | undefined
  if (piiDetected) {
    return 'PII가 감지되어 메시지 전송이 차단되었습니다'
  }
  return null
}

function checkBudgetLimit(
  policy: Policy,
  action: PolicyAction,
): string | null {
  const monthlyLimit = policy.config.monthlyLimit as number | undefined
  if (monthlyLimit === undefined) return null
  const currentSpend = (action.metadata?.currentSpend as number) ?? 0
  if (currentSpend > monthlyLimit) {
    return `월간 비용 한도(${monthlyLimit})를 초과했습니다 (현재: ${currentSpend})`
  }
  return null
}

const CHECKER_MAP: Record<
  PolicyType,
  (policy: Policy, action: PolicyAction) => string | null
> = {
  model_whitelist: checkModelWhitelist,
  tool_whitelist: checkToolWhitelist,
  assistant_approval: checkAssistantApproval,
  pii_enforcement: checkPiiEnforcement,
  budget_limit: checkBudgetLimit,
}

// ── Public API ──

export async function getPolicies(): Promise<Policy[]> {
  return loadPolicies()
}

export async function savePolicy(
  input: Omit<Policy, 'id' | 'createdAt'>,
): Promise<Policy> {
  const policies = await loadPolicies()

  const newPolicy: Policy = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  }

  const updated =
    policies.length >= MAX_POLICIES
      ? [...policies.slice(1), newPolicy]
      : [...policies, newPolicy]

  await persistPolicies(updated)
  return newPolicy
}

export async function deletePolicy(id: string): Promise<void> {
  const policies = await loadPolicies()
  const filtered = policies.filter((p) => p.id !== id)
  await persistPolicies(filtered)
}

export async function checkPolicy(
  action: PolicyAction,
): Promise<PolicyCheckResult> {
  const policies = await loadPolicies()
  const violations: string[] = []
  let enforcedBy: string | undefined

  for (const policy of policies) {
    if (!policy.enabled) continue

    const checker = CHECKER_MAP[policy.type]
    const violation = checker(policy, action)
    if (violation) {
      violations.push(violation)
      enforcedBy = enforcedBy ?? policy.id
    }
  }

  const allowed = violations.length === 0

  // Update status
  const status = await loadStatus()
  const updatedStatus: PolicyStatus = {
    ...status,
    totalViolations: status.totalViolations + violations.length,
    lastCheckAt: Date.now(),
    activePolicies: policies.filter((p) => p.enabled).length,
  }
  await persistStatus(updatedStatus)

  return {
    allowed,
    violations,
    ...(enforcedBy ? { enforcedBy } : {}),
  }
}

export async function getPolicyStatus(): Promise<PolicyStatus> {
  const policies = await loadPolicies()
  const stored = await loadStatus()
  return {
    ...stored,
    activePolicies: policies.filter((p) => p.enabled).length,
  }
}
