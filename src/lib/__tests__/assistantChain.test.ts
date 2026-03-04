import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  AssistantChainStore,
  resolveTemplate,
  validateChain,
  applyTransform,
  type ChainStep,
  type ChainStepResult,
} from '../assistantChain'

beforeEach(async () => {
  await chrome.storage.local.clear()
})

function makeSteps(count: number): ChainStep[] {
  return Array.from({ length: count }, (_, i) => ({
    assistantId: `ast-${i}`,
    promptTemplate: `Step ${i}: {{input}}`,
    transformOutput: 'none' as const,
  }))
}

// --- resolveTemplate ---

describe('resolveTemplate', () => {
  it('replaces {{input}} with previous output', () => {
    expect(resolveTemplate('Translate: {{input}}', 'hello', 'original')).toBe(
      'Translate: hello',
    )
  })

  it('replaces {{original}} with original input', () => {
    expect(resolveTemplate('Based on: {{original}}', 'current', 'first')).toBe(
      'Based on: first',
    )
  })

  it('replaces both {{input}} and {{original}}', () => {
    const result = resolveTemplate(
      'Input: {{input}}, Original: {{original}}',
      'second',
      'first',
    )
    expect(result).toBe('Input: second, Original: first')
  })

  it('returns template as-is when no placeholders', () => {
    expect(resolveTemplate('No placeholders here', 'a', 'b')).toBe(
      'No placeholders here',
    )
  })
})

// --- validateChain ---

describe('validateChain', () => {
  it('returns null for valid chain', () => {
    const result = validateChain({ name: 'Test', steps: makeSteps(2) })
    expect(result).toBeNull()
  })

  it('returns error for missing name', () => {
    const result = validateChain({ name: '  ', steps: makeSteps(2) })
    expect(result).toBe('체인 이름이 필요합니다')
  })

  it('returns error for fewer than 2 steps', () => {
    const result = validateChain({ name: 'Test', steps: makeSteps(1) })
    expect(result).toBe('최소 2개 이상의 단계가 필요합니다')
  })

  it('returns error for more than 10 steps', () => {
    const result = validateChain({ name: 'Test', steps: makeSteps(11) })
    expect(result).toContain('최대 10개')
  })
})

// --- applyTransform ---

describe('applyTransform', () => {
  it('returns output as-is for none', () => {
    expect(applyTransform('  hello  ', 'none')).toBe('  hello  ')
  })

  it('trims whitespace for trim', () => {
    expect(applyTransform('  hello  \n', 'trim')).toBe('hello')
  })

  it('extracts first paragraph for extractFirst', () => {
    const text = 'First paragraph.\n\nSecond paragraph.\n\nThird.'
    expect(applyTransform(text, 'extractFirst')).toBe('First paragraph.')
  })
})

// --- CRUD ---

describe('AssistantChainStore CRUD', () => {
  it('list returns empty array initially', async () => {
    const list = await AssistantChainStore.list()
    expect(list).toEqual([])
  })

  it('save creates chain with generated id and timestamps', async () => {
    const chain = await AssistantChainStore.save({
      name: 'Test Chain',
      description: 'A test chain',
      steps: makeSteps(2),
    })

    expect(chain.id).toMatch(/^chain-/)
    expect(chain.createdAt).toBeGreaterThan(0)
    expect(chain.updatedAt).toBeGreaterThan(0)
    expect(chain.usageCount).toBe(0)
    expect(chain.name).toBe('Test Chain')
  })

  it('get returns chain by id', async () => {
    const saved = await AssistantChainStore.save({
      name: 'Find Me',
      description: '',
      steps: makeSteps(2),
    })

    const found = await AssistantChainStore.get(saved.id)
    expect(found).not.toBeNull()
    expect(found!.name).toBe('Find Me')
  })

  it('update modifies chain and updates timestamp', async () => {
    const saved = await AssistantChainStore.save({
      name: 'Original',
      description: '',
      steps: makeSteps(2),
    })

    await new Promise((r) => setTimeout(r, 5))

    const updated = await AssistantChainStore.update(saved.id, {
      name: 'Updated',
    })

    expect(updated).not.toBeNull()
    expect(updated!.name).toBe('Updated')
    expect(updated!.updatedAt).toBeGreaterThan(saved.updatedAt)
  })

  it('remove deletes chain', async () => {
    const saved = await AssistantChainStore.save({
      name: 'Delete Me',
      description: '',
      steps: makeSteps(2),
    })

    const result = await AssistantChainStore.remove(saved.id)
    expect(result).toBe(true)

    const found = await AssistantChainStore.get(saved.id)
    expect(found).toBeNull()
  })

  it('remove returns false for non-existent id', async () => {
    const result = await AssistantChainStore.remove('nonexistent')
    expect(result).toBe(false)
  })

  it('update returns null for non-existent id', async () => {
    const result = await AssistantChainStore.update('nonexistent', { name: 'X' })
    expect(result).toBeNull()
  })
})

// --- incrementUsage ---

describe('AssistantChainStore.incrementUsage', () => {
  it('increments usage count', async () => {
    const saved = await AssistantChainStore.save({
      name: 'Counter',
      description: '',
      steps: makeSteps(2),
    })

    await AssistantChainStore.incrementUsage(saved.id)
    await AssistantChainStore.incrementUsage(saved.id)

    const updated = await AssistantChainStore.get(saved.id)
    expect(updated!.usageCount).toBe(2)
  })
})

// --- Max chains limit ---

describe('AssistantChainStore max limit', () => {
  it('enforces max chains with FIFO', async () => {
    for (let i = 0; i < 20; i++) {
      await AssistantChainStore.save({
        name: `Chain ${i}`,
        description: '',
        steps: makeSteps(2),
      })
    }

    const list = await AssistantChainStore.list()
    expect(list).toHaveLength(20)

    const newest = await AssistantChainStore.save({
      name: 'Chain 21',
      description: '',
      steps: makeSteps(2),
    })

    const updated = await AssistantChainStore.list()
    expect(updated).toHaveLength(20)
    expect(updated.some((c) => c.id === newest.id)).toBe(true)
  })
})

// --- ID generation format ---

describe('ID generation', () => {
  it('generates chain- prefixed id with timestamp', async () => {
    const chain = await AssistantChainStore.save({
      name: 'ID Test',
      description: '',
      steps: makeSteps(2),
    })

    expect(chain.id).toMatch(/^chain-\d+-[a-z0-9]{4}$/)
  })
})

// --- execute ---

describe('AssistantChainStore.execute', () => {
  it('executes a 2-step chain sequentially', async () => {
    const chain = await AssistantChainStore.save({
      name: '2-step',
      description: '',
      steps: [
        { assistantId: 'ast-1', promptTemplate: 'Translate: {{input}}', transformOutput: 'trim' },
        { assistantId: 'ast-2', promptTemplate: 'Summarize: {{input}}', transformOutput: 'none' },
      ],
    })

    const sendMessage = vi.fn()
      .mockResolvedValueOnce('  translated text  ')
      .mockResolvedValueOnce('summary result')

    const result = await AssistantChainStore.execute(chain.id, 'hello', sendMessage)

    expect(result.stepResults).toHaveLength(2)
    expect(result.stepResults[0].output).toBe('translated text')
    expect(result.finalOutput).toBe('summary result')
    expect(result.totalMs).toBeGreaterThanOrEqual(0)

    // sendMessage 호출 검증
    expect(sendMessage).toHaveBeenCalledWith('Translate: hello', 'ast-1')
    expect(sendMessage).toHaveBeenCalledWith('Summarize: translated text', 'ast-2')
  })

  it('executes a 3-step chain with original reference', async () => {
    const chain = await AssistantChainStore.save({
      name: '3-step',
      description: '',
      steps: [
        { assistantId: 'ast-1', promptTemplate: '{{input}}' },
        { assistantId: 'ast-2', promptTemplate: '{{input}} + {{original}}' },
        { assistantId: 'ast-3', promptTemplate: 'Final: {{input}}' },
      ],
    })

    const sendMessage = vi.fn()
      .mockResolvedValueOnce('step1-out')
      .mockResolvedValueOnce('step2-out')
      .mockResolvedValueOnce('step3-out')

    const onStep = vi.fn()
    const result = await AssistantChainStore.execute(
      chain.id, 'original-input', sendMessage, onStep,
    )

    expect(result.stepResults).toHaveLength(3)
    expect(result.finalOutput).toBe('step3-out')
    expect(onStep).toHaveBeenCalledTimes(3)

    // 두 번째 단계에서 original 참조 확인
    expect(sendMessage).toHaveBeenNthCalledWith(
      2, 'step1-out + original-input', 'ast-2',
    )
  })

  it('aborts execution when signal is triggered', async () => {
    const chain = await AssistantChainStore.save({
      name: 'Abort test',
      description: '',
      steps: makeSteps(3),
    })

    const controller = new AbortController()
    controller.abort()

    const sendMessage = vi.fn().mockResolvedValue('output')

    await expect(
      AssistantChainStore.execute(chain.id, 'input', sendMessage, undefined, controller.signal),
    ).rejects.toThrow('체인 실행이 중단되었습니다')

    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('throws error for non-existent chain', async () => {
    const sendMessage = vi.fn()
    await expect(
      AssistantChainStore.execute('nonexistent', 'input', sendMessage),
    ).rejects.toThrow('체인을 찾을 수 없습니다')
  })
})

// --- Export/Import ---

describe('AssistantChainStore export/import', () => {
  it('round-trips chains via export and import', async () => {
    await AssistantChainStore.save({
      name: 'Export Test',
      description: 'desc',
      steps: makeSteps(2),
    })

    const json = await AssistantChainStore.exportChains()
    const parsed = JSON.parse(json)

    expect(parsed.version).toBe(1)
    expect(parsed.exportedAt).toBeTruthy()
    expect(parsed.chains).toHaveLength(1)

    // 새 스토리지에 가져오기
    await chrome.storage.local.clear()
    const result = await AssistantChainStore.importChains(json)
    expect(result.imported).toBe(1)
    expect(result.skipped).toBe(0)

    const list = await AssistantChainStore.list()
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Export Test')
    expect(list[0].usageCount).toBe(0) // 초기화 확인
  })

  it('skips duplicates by name on import', async () => {
    await AssistantChainStore.save({
      name: 'Existing',
      description: '',
      steps: makeSteps(2),
    })

    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      chains: [
        { id: 'old', name: 'Existing', description: '', steps: makeSteps(2), createdAt: 0, updatedAt: 0, usageCount: 5 },
        { id: 'old2', name: 'New Chain', description: '', steps: makeSteps(2), createdAt: 0, updatedAt: 0, usageCount: 3 },
      ],
    }

    const result = await AssistantChainStore.importChains(JSON.stringify(exportData))
    expect(result.imported).toBe(1)
    expect(result.skipped).toBe(1)
  })

  it('throws on invalid format', async () => {
    await expect(AssistantChainStore.importChains('not json')).rejects.toThrow(
      'Invalid JSON format',
    )
    await expect(
      AssistantChainStore.importChains(JSON.stringify({ foo: 'bar' })),
    ).rejects.toThrow('Invalid chain export format')
  })
})
