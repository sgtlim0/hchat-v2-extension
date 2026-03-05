import { describe, it, expect, vi } from 'vitest'

vi.mock('../../i18n', () => ({
  getGlobalLocale: vi.fn(() => 'en'),
}))

vi.mock('../providers/bedrock-provider', () => ({
  BedrockProvider: vi.fn().mockImplementation(function () {
    return {
      type: 'bedrock',
      models: [],
      isConfigured: () => true,
      stream: async function* () { yield 'test'; return 'test' },
      testConnection: async () => true,
    }
  }),
}))

vi.mock('../usage', () => ({
  Usage: { track: vi.fn(async () => {}) },
}))

import { runAgent } from '../agent'
import type { Tool, AgentOptions } from '../agent'

function makeMockProvider(streamFn: () => AsyncGenerator<string, string>) {
  return {
    type: 'openai' as const,
    models: [],
    isConfigured: () => true,
    stream: streamFn,
    testConnection: async () => true,
  }
}

function makeOpts(overrides: Partial<AgentOptions> & { provider: AgentOptions['provider'] }): AgentOptions {
  return {
    aws: { accessKeyId: '', secretAccessKey: '', region: 'us-east-1' },
    model: 'gpt-4o',
    userMessage: 'Hi',
    tools: [],
    onStep: vi.fn(),
    ...overrides,
  }
}

describe('runAgent', () => {
  it('returns final text when no tool calls in response', async () => {
    const provider = makeMockProvider(async function* () {
      yield 'Hello, how can I help?'
      return 'Hello, how can I help?'
    })

    const result = await runAgent(makeOpts({ provider }))

    expect(result.finalText).toBe('Hello, how can I help?')
    // steps includes the final response step
    expect(result.steps.some((s) => s.type === 'response')).toBe(true)
  })

  it('executes tool calls and continues', async () => {
    let callCount = 0
    const provider = makeMockProvider(async function* () {
      callCount++
      if (callCount === 1) {
        const text = '<tool_call>\n<name>test_tool</name>\n<params>{"input":"hello"}</params>\n</tool_call>'
        yield text
        return text
      }
      yield 'Final answer'
      return 'Final answer'
    })

    const tools: Tool[] = [{
      name: 'test_tool',
      description: 'A test tool',
      parameters: { input: { type: 'string', description: 'Input', required: true } },
      execute: async (params) => `Processed: ${params.input}`,
    }]

    const onStep = vi.fn()
    const result = await runAgent(makeOpts({ provider, tools, onStep }))

    expect(result.steps.some((s) => s.type === 'tool_call')).toBe(true)
    expect(result.steps.some((s) => s.type === 'tool_result' && s.content.includes('Processed: hello'))).toBe(true)
    expect(onStep).toHaveBeenCalled()
  })

  it('handles tool execution error', async () => {
    let callCount = 0
    const provider = makeMockProvider(async function* () {
      callCount++
      if (callCount === 1) {
        const text = '<tool_call>\n<name>fail_tool</name>\n<params>{}</params>\n</tool_call>'
        yield text
        return text
      }
      yield 'Handled error'
      return 'Handled error'
    })

    const tools: Tool[] = [{
      name: 'fail_tool',
      description: 'Always fails',
      parameters: {},
      execute: async () => { throw new Error('Tool exploded') },
    }]

    const result = await runAgent(makeOpts({ provider, tools }))

    expect(result.steps.some((s) => s.type === 'tool_result' && s.content.includes('Error'))).toBe(true)
  })

  it('handles unknown tool name', async () => {
    let callCount = 0
    const provider = makeMockProvider(async function* () {
      callCount++
      if (callCount === 1) {
        const text = '<tool_call>\n<name>nonexistent</name>\n<params>{}</params>\n</tool_call>'
        yield text
        return text
      }
      yield 'Done'
      return 'Done'
    })

    const result = await runAgent(makeOpts({ provider, tools: [] }))

    expect(result.steps.some((s) => s.type === 'tool_result' && s.content.includes('not found'))).toBe(true)
  })

  it('respects maxSteps limit', async () => {
    const provider = makeMockProvider(async function* () {
      const text = '<tool_call>\n<name>loop_tool</name>\n<params>{}</params>\n</tool_call>'
      yield text
      return text
    })

    const tools: Tool[] = [{
      name: 'loop_tool',
      description: 'Loops',
      parameters: {},
      execute: async () => 'result',
    }]

    const result = await runAgent(makeOpts({ provider, tools, maxSteps: 3 }))

    // Each step produces: thinking (except first) + tool_call + tool_result, then final max-step response
    const toolCalls = result.steps.filter((s) => s.type === 'tool_call')
    expect(toolCalls.length).toBeLessThanOrEqual(3)
  })

  it('truncates large tool results', async () => {
    let callCount = 0
    const provider = makeMockProvider(async function* () {
      callCount++
      if (callCount === 1) {
        const text = '<tool_call>\n<name>big_tool</name>\n<params>{}</params>\n</tool_call>'
        yield text
        return text
      }
      yield 'Done'
      return 'Done'
    })

    const tools: Tool[] = [{
      name: 'big_tool',
      description: 'Returns big result',
      parameters: {},
      execute: async () => 'x'.repeat(5000),
    }]

    const result = await runAgent(makeOpts({ provider, tools }))
    const resultStep = result.steps.find((s) => s.type === 'tool_result')
    expect(resultStep!.content.length).toBeLessThan(5000)
    expect(resultStep!.content).toContain('생략')
  })

  it('falls back to BedrockProvider when no provider given', async () => {
    // provider is undefined → falls back to BedrockProvider mock
    const result = await runAgent(makeOpts({
      provider: undefined,
      aws: { accessKeyId: 'key', secretAccessKey: 'secret', region: 'us-east-1' },
    }))

    expect(result.finalText).toBe('test')
  })

  it('aborts when signal is aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    const provider = makeMockProvider(async function* () {
      yield 'x'
      return 'x'
    })

    await expect(runAgent(makeOpts({ provider, signal: controller.signal }))).rejects.toThrow('Aborted')
  })

  it('merges customTools with tools', async () => {
    let callCount = 0
    const provider = makeMockProvider(async function* () {
      callCount++
      if (callCount === 1) {
        const text = '<tool_call>\n<name>custom_tool</name>\n<params>{}</params>\n</tool_call>'
        yield text
        return text
      }
      yield 'Done'
      return 'Done'
    })

    const customTools: Tool[] = [{
      name: 'custom_tool',
      description: 'Custom',
      parameters: {},
      execute: async () => 'custom result',
    }]

    const result = await runAgent(makeOpts({ provider, customTools }))
    expect(result.steps.some((s) => s.type === 'tool_result' && s.content === 'custom result')).toBe(true)
  })
})
