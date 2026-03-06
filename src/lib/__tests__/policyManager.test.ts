// lib/__tests__/policyManager.test.ts — Tests for policy management system

import { describe, it, expect, beforeEach } from 'vitest'
import {
  getPolicies,
  savePolicy,
  deletePolicy,
  checkPolicy,
  getPolicyStatus,
  type Policy,
  type PolicyType,
  type PolicyAction,
} from '../policyManager'

function makePolicy(overrides: Partial<Policy> & { type: PolicyType }): Omit<Policy, 'id' | 'createdAt'> {
  return {
    type: overrides.type,
    name: overrides.name ?? `Test ${overrides.type}`,
    enabled: overrides.enabled ?? true,
    config: overrides.config ?? {},
  }
}

describe('policyManager', () => {
  // ── CRUD ──
  describe('CRUD', () => {
    it('should return empty array when no policies exist', async () => {
      const policies = await getPolicies()
      expect(policies).toEqual([])
    })

    it('should save and retrieve a policy', async () => {
      const saved = await savePolicy(makePolicy({ type: 'model_whitelist', config: { models: ['claude-sonnet'] } }))

      expect(saved.id).toBeDefined()
      expect(saved.createdAt).toBeGreaterThan(0)
      expect(saved.type).toBe('model_whitelist')

      const policies = await getPolicies()
      expect(policies).toHaveLength(1)
      expect(policies[0].id).toBe(saved.id)
    })

    it('should delete a policy by id', async () => {
      const saved = await savePolicy(makePolicy({ type: 'tool_whitelist' }))
      await deletePolicy(saved.id)

      const policies = await getPolicies()
      expect(policies).toHaveLength(0)
    })

    it('should enforce max 20 policies (oldest removed)', async () => {
      for (let i = 0; i < 20; i++) {
        await savePolicy(makePolicy({ type: 'model_whitelist', name: `Policy ${i}` }))
      }

      const before = await getPolicies()
      expect(before).toHaveLength(20)

      await savePolicy(makePolicy({ type: 'tool_whitelist', name: 'Policy 20 (overflow)' }))

      const after = await getPolicies()
      expect(after).toHaveLength(20)
      // First policy should have been evicted
      expect(after.find((p) => p.name === 'Policy 0')).toBeUndefined()
      expect(after.find((p) => p.name === 'Policy 20 (overflow)')).toBeDefined()
    })

    it('should not fail when deleting a non-existent policy', async () => {
      await expect(deletePolicy('non-existent-id')).resolves.toBeUndefined()
    })
  })

  // ── model_whitelist ──
  describe('model_whitelist', () => {
    beforeEach(async () => {
      await savePolicy(makePolicy({
        type: 'model_whitelist',
        config: { models: ['claude-sonnet', 'gpt-4o'] },
      }))
    })

    it('should allow whitelisted model', async () => {
      const action: PolicyAction = { type: 'use_model', target: 'claude-sonnet' }
      const result = await checkPolicy(action)
      expect(result.allowed).toBe(true)
      expect(result.violations).toHaveLength(0)
    })

    it('should block non-whitelisted model', async () => {
      const action: PolicyAction = { type: 'use_model', target: 'gemini-pro' }
      const result = await checkPolicy(action)
      expect(result.allowed).toBe(false)
      expect(result.violations).toHaveLength(1)
      expect(result.enforcedBy).toBeDefined()
    })
  })

  // ── tool_whitelist ──
  describe('tool_whitelist', () => {
    beforeEach(async () => {
      await savePolicy(makePolicy({
        type: 'tool_whitelist',
        config: { tools: ['summarize', 'translate'] },
      }))
    })

    it('should allow whitelisted tool', async () => {
      const action: PolicyAction = { type: 'use_tool', target: 'summarize' }
      const result = await checkPolicy(action)
      expect(result.allowed).toBe(true)
    })

    it('should block non-whitelisted tool', async () => {
      const action: PolicyAction = { type: 'use_tool', target: 'image_gen' }
      const result = await checkPolicy(action)
      expect(result.allowed).toBe(false)
      expect(result.violations.length).toBeGreaterThan(0)
    })
  })

  // ── pii_enforcement ──
  describe('pii_enforcement', () => {
    it('should enforce PII guardrail on send_message', async () => {
      await savePolicy(makePolicy({
        type: 'pii_enforcement',
        config: { enforced: true },
      }))

      const action: PolicyAction = {
        type: 'send_message',
        target: 'chat',
        metadata: { piiDetected: true },
      }
      const result = await checkPolicy(action)
      expect(result.allowed).toBe(false)
      expect(result.violations).toHaveLength(1)
    })

    it('should allow send_message when no PII detected', async () => {
      await savePolicy(makePolicy({
        type: 'pii_enforcement',
        config: { enforced: true },
      }))

      const action: PolicyAction = {
        type: 'send_message',
        target: 'chat',
        metadata: { piiDetected: false },
      }
      const result = await checkPolicy(action)
      expect(result.allowed).toBe(true)
    })
  })

  // ── budget_limit ──
  describe('budget_limit', () => {
    it('should block when budget exceeded', async () => {
      await savePolicy(makePolicy({
        type: 'budget_limit',
        config: { monthlyLimit: 100 },
      }))

      const action: PolicyAction = {
        type: 'send_message',
        target: 'chat',
        metadata: { currentSpend: 120 },
      }
      const result = await checkPolicy(action)
      expect(result.allowed).toBe(false)
      expect(result.violations).toHaveLength(1)
    })

    it('should allow when within budget', async () => {
      await savePolicy(makePolicy({
        type: 'budget_limit',
        config: { monthlyLimit: 100 },
      }))

      const action: PolicyAction = {
        type: 'send_message',
        target: 'chat',
        metadata: { currentSpend: 50 },
      }
      const result = await checkPolicy(action)
      expect(result.allowed).toBe(true)
    })
  })

  // ── assistant_approval ──
  describe('assistant_approval', () => {
    it('should block unapproved assistant', async () => {
      await savePolicy(makePolicy({
        type: 'assistant_approval',
        config: { approvedAssistants: ['writer', 'coder'] },
      }))

      const action: PolicyAction = { type: 'use_assistant', target: 'hacker' }
      const result = await checkPolicy(action)
      expect(result.allowed).toBe(false)
    })

    it('should allow approved assistant', async () => {
      await savePolicy(makePolicy({
        type: 'assistant_approval',
        config: { approvedAssistants: ['writer', 'coder'] },
      }))

      const action: PolicyAction = { type: 'use_assistant', target: 'writer' }
      const result = await checkPolicy(action)
      expect(result.allowed).toBe(true)
    })
  })

  // ── Multiple policies ──
  describe('multiple policies', () => {
    it('should pass when all policies allow', async () => {
      await savePolicy(makePolicy({
        type: 'model_whitelist',
        config: { models: ['claude-sonnet'] },
      }))
      await savePolicy(makePolicy({
        type: 'budget_limit',
        config: { monthlyLimit: 100 },
      }))

      const action: PolicyAction = {
        type: 'use_model',
        target: 'claude-sonnet',
        metadata: { currentSpend: 50 },
      }
      const result = await checkPolicy(action)
      expect(result.allowed).toBe(true)
      expect(result.violations).toHaveLength(0)
    })

    it('should fail when any policy violates', async () => {
      await savePolicy(makePolicy({
        type: 'model_whitelist',
        config: { models: ['claude-sonnet'] },
      }))
      await savePolicy(makePolicy({
        type: 'budget_limit',
        config: { monthlyLimit: 100 },
      }))

      const action: PolicyAction = {
        type: 'use_model',
        target: 'claude-sonnet',
        metadata: { currentSpend: 120 },
      }
      const result = await checkPolicy(action)
      expect(result.allowed).toBe(false)
      expect(result.violations.length).toBeGreaterThan(0)
    })
  })

  // ── Disabled policy ──
  describe('disabled policy', () => {
    it('should ignore disabled policies', async () => {
      await savePolicy(makePolicy({
        type: 'model_whitelist',
        enabled: false,
        config: { models: ['claude-sonnet'] },
      }))

      const action: PolicyAction = { type: 'use_model', target: 'gemini-pro' }
      const result = await checkPolicy(action)
      expect(result.allowed).toBe(true)
      expect(result.violations).toHaveLength(0)
    })
  })

  // ── getPolicyStatus ──
  describe('getPolicyStatus', () => {
    it('should return zero counts when no policies exist', async () => {
      const status = await getPolicyStatus()
      expect(status.activePolicies).toBe(0)
      expect(status.totalViolations).toBe(0)
      expect(status.lastCheckAt).toBe(0)
    })

    it('should count active policies and track violations', async () => {
      await savePolicy(makePolicy({
        type: 'model_whitelist',
        config: { models: ['claude-sonnet'] },
      }))
      await savePolicy(makePolicy({
        type: 'tool_whitelist',
        enabled: false,
        config: { tools: ['summarize'] },
      }))

      // Trigger a violation
      await checkPolicy({ type: 'use_model', target: 'gemini-pro' })

      const status = await getPolicyStatus()
      expect(status.activePolicies).toBe(1) // only enabled ones
      expect(status.totalViolations).toBe(1)
      expect(status.lastCheckAt).toBeGreaterThan(0)
    })
  })

  // ── No matching policy type ──
  describe('no matching policy', () => {
    it('should allow action when no relevant policy exists', async () => {
      await savePolicy(makePolicy({
        type: 'tool_whitelist',
        config: { tools: ['summarize'] },
      }))

      // use_model action, but only tool_whitelist policy exists
      const action: PolicyAction = { type: 'use_model', target: 'gemini-pro' }
      const result = await checkPolicy(action)
      expect(result.allowed).toBe(true)
    })
  })
})
