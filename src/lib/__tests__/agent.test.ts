import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runAgent, type Tool, type AgentOptions } from '../agent'
import type { AIProvider, Message } from '../providers/types'

// Mock i18n
vi.mock('../../i18n', () => ({
  getGlobalLocale: vi.fn(() => 'ko'),
}))

// Mock provider
class MockProvider implements AIProvider {
  type = 'bedrock' as const
  models = []

  isConfigured(): boolean {
    return true
  }

  async *stream(params: { model: string; messages: Message[]; systemPrompt?: string }): AsyncGenerator<string, string> {
    const lastMsg = params.messages[params.messages.length - 1]

    // Check if last message contains tool results
    if (lastMsg.role === 'user' && typeof lastMsg.content === 'string' && lastMsg.content.includes('[Tool Result:')) {
      // Final response after tool execution
      yield '도구 결과를 분석했습니다. '
      yield '최종 답변입니다.'
      return '도구 결과를 분석했습니다. 최종 답변입니다.'
    }

    // Initial response with tool call
    const response = `
생각 중입니다.

<tool_call>
<name>test_tool</name>
<params>{"arg": "value"}</params>
</tool_call>
`
    yield response
    return response
  }

  async testConnection(): Promise<boolean> {
    return true
  }
}

describe('agent', () => {
  let mockTool: Tool
  let mockProvider: AIProvider
  let agentOptions: AgentOptions

  beforeEach(() => {
    mockTool = {
      name: 'test_tool',
      description: '테스트 도구입니다.',
      parameters: {
        arg: { type: 'string', description: '인자', required: true },
      },
      execute: vi.fn(async (params) => {
        return `도구 실행됨: ${JSON.stringify(params)}`
      }),
    }

    mockProvider = new MockProvider()

    agentOptions = {
      aws: { accessKeyId: 'test', secretAccessKey: 'test', region: 'us-east-1' },
      model: 'test-model',
      userMessage: '테스트 메시지',
      tools: [mockTool],
      onStep: vi.fn(),
      provider: mockProvider,
    }
  })

  describe('parseToolCalls', () => {
    it('extracts single tool call from XML', async () => {
      const result = await runAgent(agentOptions)
      expect(mockTool.execute).toHaveBeenCalledWith({ arg: 'value' })
    })

    it('handles multiple tool calls in response', async () => {
      class MultiToolProvider implements AIProvider {
        type = 'bedrock' as const
        models = []
        isConfigured() { return true }
        async testConnection() { return true }

        async *stream(params: { messages: Message[] }): AsyncGenerator<string, string> {
          const lastMsg = params.messages[params.messages.length - 1]
          if (lastMsg.role === 'user' && typeof lastMsg.content === 'string' && lastMsg.content.includes('[Tool Result:')) {
            yield '완료'
            return '완료'
          }

          const response = `
<tool_call>
<name>test_tool</name>
<params>{"arg": "first"}</params>
</tool_call>

<tool_call>
<name>test_tool</name>
<params>{"arg": "second"}</params>
</tool_call>
`
          yield response
          return response
        }
      }

      const result = await runAgent({ ...agentOptions, provider: new MultiToolProvider() })
      expect(mockTool.execute).toHaveBeenCalledTimes(2)
      expect(mockTool.execute).toHaveBeenNthCalledWith(1, { arg: 'first' })
      expect(mockTool.execute).toHaveBeenNthCalledWith(2, { arg: 'second' })
    })

    it('handles malformed XML gracefully', async () => {
      class MalformedProvider implements AIProvider {
        type = 'bedrock' as const
        models = []
        isConfigured() { return true }
        async testConnection() { return true }

        async *stream(): AsyncGenerator<string, string> {
          const response = `
<tool_call>
<name>test_tool</name>
<params>{invalid json}</params>
</tool_call>
`
          yield response
          return response
        }
      }

      const result = await runAgent({ ...agentOptions, provider: new MalformedProvider() })
      // Should not execute tool with invalid JSON
      expect(mockTool.execute).not.toHaveBeenCalled()
      expect(result.finalText).toBeTruthy()
    })
  })

  describe('multi-turn execution', () => {
    it('executes single-turn tool call', async () => {
      const result = await runAgent(agentOptions)

      expect(mockTool.execute).toHaveBeenCalled()
      expect(agentOptions.onStep).toHaveBeenCalled()
      expect(result.finalText).toContain('최종 답변')
      expect(result.steps.length).toBeGreaterThan(0)
    })

    it('handles multi-turn agent loop with tool results', async () => {
      let callCount = 0
      class MultiTurnProvider implements AIProvider {
        type = 'bedrock' as const
        models = []
        isConfigured() { return true }
        async testConnection() { return true }

        async *stream(params: { messages: Message[] }): AsyncGenerator<string, string> {
          callCount++
          const lastMsg = params.messages[params.messages.length - 1]

          if (lastMsg.role === 'user' && typeof lastMsg.content === 'string' && lastMsg.content.includes('[Tool Result:')) {
            // Final response
            yield '완료했습니다.'
            return '완료했습니다.'
          }

          // First call - request tool
          const response = `
<tool_call>
<name>test_tool</name>
<params>{"arg": "value"}</params>
</tool_call>
`
          yield response
          return response
        }
      }

      const result = await runAgent({ ...agentOptions, provider: new MultiTurnProvider() })

      expect(callCount).toBeGreaterThanOrEqual(2) // At least 2 turns
      expect(mockTool.execute).toHaveBeenCalled()
      expect(result.finalText).toContain('완료했습니다')
    })
  })

  describe('tool not found', () => {
    it('returns error when tool does not exist', async () => {
      class UnknownToolProvider implements AIProvider {
        type = 'bedrock' as const
        models = []
        isConfigured() { return true }
        async testConnection() { return true }

        async *stream(): AsyncGenerator<string, string> {
          const response = `
<tool_call>
<name>unknown_tool</name>
<params>{"arg": "value"}</params>
</tool_call>
`
          yield response
          return response
        }
      }

      const result = await runAgent({ ...agentOptions, provider: new UnknownToolProvider() })

      const toolResultStep = result.steps.find((s) => s.type === 'tool_result')
      expect(toolResultStep?.content).toContain('not found')
    })
  })

  describe('max steps limit', () => {
    it('respects max turns limit', async () => {
      class InfiniteLoopProvider implements AIProvider {
        type = 'bedrock' as const
        models = []
        isConfigured() { return true }
        async testConnection() { return true }

        async *stream(): AsyncGenerator<string, string> {
          // Always return a tool call (infinite loop)
          const response = `
<tool_call>
<name>test_tool</name>
<params>{"arg": "loop"}</params>
</tool_call>
`
          yield response
          return response
        }
      }

      const result = await runAgent({
        ...agentOptions,
        provider: new InfiniteLoopProvider(),
        maxSteps: 3,
      })

      expect(mockTool.execute).toHaveBeenCalledTimes(3)
      expect(result.finalText).toContain('최대 단계')
    })
  })

  describe('tool result formatting', () => {
    it('includes tool name and result in step', async () => {
      const result = await runAgent(agentOptions)

      const toolCallStep = result.steps.find((s) => s.type === 'tool_call')
      expect(toolCallStep).toBeDefined()
      expect(toolCallStep?.toolName).toBe('test_tool')
      expect(toolCallStep?.toolInput).toEqual({ arg: 'value' })

      const toolResultStep = result.steps.find((s) => s.type === 'tool_result')
      expect(toolResultStep).toBeDefined()
      expect(toolResultStep?.content).toContain('도구 실행됨')
    })

    it('truncates large results', async () => {
      const largeTool: Tool = {
        ...mockTool,
        execute: vi.fn(async () => {
          return 'x'.repeat(5000) // > 4000 chars
        }),
      }

      const result = await runAgent({
        ...agentOptions,
        tools: [largeTool],
      })

      const toolResultStep = result.steps.find((s) => s.type === 'tool_result')
      expect(toolResultStep?.content.length).toBeLessThanOrEqual(4050) // 4000 + "...(결과 일부 생략)"
      expect(toolResultStep?.content).toContain('결과 일부 생략')
    })
  })

  describe('custom tools', () => {
    it('merges custom tools with built-in tools', async () => {
      const customTool: Tool = {
        name: 'custom_tool',
        description: '커스텀 도구',
        parameters: {},
        execute: vi.fn(async () => 'custom result'),
      }

      class CustomToolProvider implements AIProvider {
        type = 'bedrock' as const
        models = []
        isConfigured() { return true }
        async testConnection() { return true }

        async *stream(): AsyncGenerator<string, string> {
          const response = `
<tool_call>
<name>custom_tool</name>
<params>{}</params>
</tool_call>
`
          yield response
          return response
        }
      }

      const result = await runAgent({
        ...agentOptions,
        customTools: [customTool],
        provider: new CustomToolProvider(),
      })

      expect(customTool.execute).toHaveBeenCalled()
    })
  })

  describe('abort signal', () => {
    it('throws AbortError when signal is aborted', async () => {
      const controller = new AbortController()
      controller.abort()

      await expect(
        runAgent({
          ...agentOptions,
          signal: controller.signal,
        })
      ).rejects.toThrow('Aborted')
    })
  })

  describe('history context', () => {
    it('includes history messages in context', async () => {
      const historyMessages: Message[] = [
        { role: 'user', content: '이전 질문' },
        { role: 'assistant', content: '이전 답변' },
      ]

      let capturedMessages: Message[] = []
      class HistoryProvider implements AIProvider {
        type = 'bedrock' as const
        models = []
        isConfigured() { return true }
        async testConnection() { return true }

        async *stream(params: { messages: Message[] }): AsyncGenerator<string, string> {
          capturedMessages = params.messages
          yield '답변'
          return '답변'
        }
      }

      await runAgent({
        ...agentOptions,
        history: historyMessages,
        provider: new HistoryProvider(),
      })

      expect(capturedMessages.length).toBeGreaterThanOrEqual(3) // history + new user message
      expect(capturedMessages[0].content).toBe('이전 질문')
      expect(capturedMessages[1].content).toBe('이전 답변')
    })
  })
})
