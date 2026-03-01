// lib/agent.ts — Multi-turn agent loop with tool calling
// Uses text-based tool parsing (XML tags) for cross-provider compatibility

import { streamChatLive, type Message } from './models'
import type { AwsCredentials } from '../hooks/useConfig'

export interface Tool {
  name: string
  description: string
  parameters: Record<string, { type: string; description: string; required?: boolean }>
  execute: (params: Record<string, unknown>) => Promise<string>
}

export interface AgentStep {
  id: string
  type: 'thinking' | 'tool_call' | 'tool_result' | 'response'
  content: string
  toolName?: string
  toolInput?: Record<string, unknown>
  ts: number
}

export interface AgentOptions {
  aws: AwsCredentials
  model: string
  userMessage: string
  tools: Tool[]
  history?: Message[]
  systemPrompt?: string
  maxSteps?: number
  onStep: (step: AgentStep) => void
  onChunk?: (chunk: string) => void
  signal?: AbortSignal
}

function uid(): string {
  return crypto.randomUUID()
}

function buildToolsDescription(tools: Tool[]): string {
  return tools.map((t) => {
    const params = Object.entries(t.parameters)
      .map(([k, v]) => `  - ${k} (${v.type}${v.required ? ', 필수' : ''}): ${v.description}`)
      .join('\n')
    return `### ${t.name}\n${t.description}\n파라미터:\n${params}`
  }).join('\n\n')
}

function buildAgentSystemPrompt(tools: Tool[], extraSystem?: string): string {
  return [
    '당신은 도구를 사용할 수 있는 AI 에이전트입니다. 한국어로 답변하세요.',
    '',
    '## 사용 가능한 도구',
    '',
    buildToolsDescription(tools),
    '',
    '## 도구 호출 형식',
    '',
    '도구를 사용하려면 다음 XML 형식을 사용하세요:',
    '',
    '<tool_call>',
    '<name>도구이름</name>',
    '<params>{"key": "value"}</params>',
    '</tool_call>',
    '',
    '도구 호출 없이 최종 답변을 하려면 일반 텍스트로 응답하세요.',
    '여러 도구를 순차적으로 사용할 수 있습니다.',
    '도구 결과를 분석한 후 추가 도구 사용이 필요하면 다시 호출하세요.',
    '',
    extraSystem ?? '',
  ].filter(Boolean).join('\n')
}

interface ParsedToolCall {
  name: string
  input: Record<string, unknown>
}

function parseToolCalls(response: string): ParsedToolCall[] {
  const calls: ParsedToolCall[] = []
  const regex = /<tool_call>\s*<name>(.*?)<\/name>\s*<params>(.*?)<\/params>\s*<\/tool_call>/gs
  let match

  while ((match = regex.exec(response)) !== null) {
    try {
      const name = match[1].trim()
      const input = JSON.parse(match[2].trim())
      calls.push({ name, input })
    } catch {
      // Invalid params JSON, skip
    }
  }

  return calls
}

function stripToolCalls(response: string): string {
  return response
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
    .trim()
}

export async function runAgent(opts: AgentOptions): Promise<{ finalText: string; steps: AgentStep[] }> {
  const {
    tools,
    maxSteps = 10,
    onStep,
    onChunk,
    signal,
  } = opts

  const systemPrompt = buildAgentSystemPrompt(tools, opts.systemPrompt)
  const steps: AgentStep[] = []

  const history: Message[] = [
    ...(opts.history ?? []),
    { role: 'user' as const, content: opts.userMessage },
  ]

  for (let step = 0; step < maxSteps; step++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    // Collect full response via streaming
    let fullResponse = ''

    const thinkingStep: AgentStep = {
      id: uid(),
      type: 'thinking',
      content: '',
      ts: Date.now(),
    }

    if (step > 0) {
      onStep(thinkingStep)
      steps.push(thinkingStep)
    }

    await streamChatLive({
      aws: opts.aws,
      model: opts.model,
      messages: history,
      systemPrompt,
      maxTokens: 4096,
      onChunk: (chunk) => {
        fullResponse += chunk
        onChunk?.(chunk)
      },
    })

    // Parse tool calls from response
    const toolCalls = parseToolCalls(fullResponse)

    if (toolCalls.length === 0) {
      // No tool calls — this is the final response
      const responseStep: AgentStep = {
        id: uid(),
        type: 'response',
        content: fullResponse,
        ts: Date.now(),
      }
      onStep(responseStep)
      steps.push(responseStep)
      return { finalText: fullResponse, steps }
    }

    // Has tool calls — execute them
    const textBeforeTools = stripToolCalls(fullResponse)
    if (textBeforeTools) {
      // Update thinking step with the text before tools
      thinkingStep.content = textBeforeTools
    }

    // Add assistant message to history
    history.push({ role: 'assistant', content: fullResponse })

    // Execute each tool call
    const toolResults: string[] = []

    for (const call of toolCalls) {
      const callStep: AgentStep = {
        id: uid(),
        type: 'tool_call',
        content: `${call.name}(${JSON.stringify(call.input)})`,
        toolName: call.name,
        toolInput: call.input,
        ts: Date.now(),
      }
      onStep(callStep)
      steps.push(callStep)

      const tool = tools.find((t) => t.name === call.name)
      let result: string

      if (!tool) {
        result = `Error: Tool "${call.name}" not found.`
      } else {
        try {
          result = await tool.execute(call.input)
        } catch (err) {
          result = `Error: ${String(err)}`
        }
      }

      // Truncate large results
      if (result.length > 4000) {
        result = result.slice(0, 4000) + '\n...(결과 일부 생략)'
      }

      const resultStep: AgentStep = {
        id: uid(),
        type: 'tool_result',
        content: result,
        toolName: call.name,
        ts: Date.now(),
      }
      onStep(resultStep)
      steps.push(resultStep)

      toolResults.push(`[Tool Result: ${call.name}]\n${result}`)
    }

    // Add tool results back to history for next iteration
    history.push({
      role: 'user',
      content: toolResults.join('\n\n'),
    })
  }

  // Max steps reached
  const maxStep: AgentStep = {
    id: uid(),
    type: 'response',
    content: '최대 단계 수에 도달했습니다. 더 구체적인 요청을 해주세요.',
    ts: Date.now(),
  }
  onStep(maxStep)
  steps.push(maxStep)
  return { finalText: maxStep.content, steps }
}
