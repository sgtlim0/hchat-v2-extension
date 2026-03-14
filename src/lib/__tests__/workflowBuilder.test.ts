import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getWorkflows,
  saveWorkflow,
  deleteWorkflow,
  validateWorkflow,
  executeWorkflow,
  exportWorkflows,
  importWorkflows,
  type Workflow,
  type WorkflowNode,
  type NodeExecutor,
} from '../workflowBuilder'

beforeEach(async () => {
  await chrome.storage.local.clear()
})

function makeNode(overrides: Partial<WorkflowNode> = {}): WorkflowNode {
  return {
    id: 'node-1',
    type: 'ai_call',
    label: 'AI Node',
    config: { modelId: 'claude', systemPrompt: '', userPrompt: '{{input}}' },
    ...overrides,
  }
}

function makeWorkflow(overrides: Partial<Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>> = {}) {
  const node1 = makeNode({ id: 'n1', nextNodeId: 'n2' })
  const node2 = makeNode({ id: 'n2', label: 'Node 2' })
  return {
    name: 'Test Workflow',
    nodes: [node1, node2],
    startNodeId: 'n1',
    ...overrides,
  }
}

// --- CRUD ---

describe('getWorkflows', () => {
  it('returns empty array initially', async () => {
    const list = await getWorkflows()
    expect(list).toEqual([])
  })
})

describe('saveWorkflow', () => {
  it('creates workflow with generated id and timestamps', async () => {
    const wf = await saveWorkflow(makeWorkflow())

    expect(wf.id).toMatch(/^wf-/)
    expect(wf.createdAt).toBeGreaterThan(0)
    expect(wf.updatedAt).toBeGreaterThan(0)
    expect(wf.name).toBe('Test Workflow')
  })

  it('persists workflow to storage', async () => {
    await saveWorkflow(makeWorkflow())
    const list = await getWorkflows()
    expect(list).toHaveLength(1)
  })

  it('enforces max 20 workflows with FIFO', async () => {
    for (let i = 0; i < 20; i++) {
      await saveWorkflow(makeWorkflow({ name: `WF ${i}` }))
    }

    const newest = await saveWorkflow(makeWorkflow({ name: 'WF 21' }))
    const list = await getWorkflows()

    expect(list).toHaveLength(20)
    expect(list.some((w) => w.id === newest.id)).toBe(true)
    // 첫 번째(가장 오래된)가 제거됨
    expect(list.some((w) => w.name === 'WF 0')).toBe(false)
  })
})

describe('deleteWorkflow', () => {
  it('removes workflow by id', async () => {
    const wf = await saveWorkflow(makeWorkflow())
    await deleteWorkflow(wf.id)
    const list = await getWorkflows()
    expect(list).toHaveLength(0)
  })

  it('does nothing for non-existent id', async () => {
    await saveWorkflow(makeWorkflow())
    await deleteWorkflow('nonexistent')
    const list = await getWorkflows()
    expect(list).toHaveLength(1)
  })
})

// --- validateWorkflow ---

describe('validateWorkflow', () => {
  it('returns valid for a correct workflow', () => {
    const node1 = makeNode({ id: 'n1', nextNodeId: 'n2' })
    const node2 = makeNode({ id: 'n2' })
    const wf = {
      id: 'wf-1',
      name: 'Valid',
      nodes: [node1, node2],
      startNodeId: 'n1',
      createdAt: 0,
      updatedAt: 0,
    } satisfies Workflow

    const result = validateWorkflow(wf)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('detects empty nodes', () => {
    const wf: Workflow = {
      id: 'wf-1',
      name: 'Empty',
      nodes: [],
      startNodeId: 'n1',
      createdAt: 0,
      updatedAt: 0,
    }

    const result = validateWorkflow(wf)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('최소 1개'))).toBe(true)
  })

  it('detects missing start node', () => {
    const node1 = makeNode({ id: 'n1' })
    const wf: Workflow = {
      id: 'wf-1',
      name: 'No Start',
      nodes: [node1],
      startNodeId: 'missing',
      createdAt: 0,
      updatedAt: 0,
    }

    const result = validateWorkflow(wf)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('시작 노드'))).toBe(true)
  })

  it('detects disconnected nodes', () => {
    const node1 = makeNode({ id: 'n1' })
    const node2 = makeNode({ id: 'n2' }) // n2는 연결되지 않음
    const wf: Workflow = {
      id: 'wf-1',
      name: 'Disconnected',
      nodes: [node1, node2],
      startNodeId: 'n1',
      createdAt: 0,
      updatedAt: 0,
    }

    const result = validateWorkflow(wf)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('연결되지 않은'))).toBe(true)
  })

  it('detects cycle in workflow', () => {
    const node1 = makeNode({ id: 'n1', nextNodeId: 'n2' })
    const node2 = makeNode({ id: 'n2', nextNodeId: 'n1' })
    const wf: Workflow = {
      id: 'wf-1',
      name: 'Cycle',
      nodes: [node1, node2],
      startNodeId: 'n1',
      createdAt: 0,
      updatedAt: 0,
    }

    const result = validateWorkflow(wf)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('순환'))).toBe(true)
  })
})

// --- executeWorkflow ---

describe('executeWorkflow', () => {
  const mockExecutor: NodeExecutor = vi.fn(async (node, input) => {
    return `[${node.label}] ${input}`
  })

  beforeEach(() => {
    vi.mocked(mockExecutor).mockClear()
  })

  it('executes single node workflow', async () => {
    const node = makeNode({ id: 'n1', label: 'Only' })
    const wf: Workflow = {
      id: 'wf-1',
      name: 'Single',
      nodes: [node],
      startNodeId: 'n1',
      createdAt: 0,
      updatedAt: 0,
    }

    const result = await executeWorkflow(wf, 'hello', mockExecutor)

    expect(result.success).toBe(true)
    expect(result.output).toBe('[Only] hello')
    expect(result.steps).toHaveLength(1)
    expect(result.steps[0].nodeId).toBe('n1')
  })

  it('executes sequential 2-node workflow', async () => {
    const node1 = makeNode({ id: 'n1', label: 'First', nextNodeId: 'n2' })
    const node2 = makeNode({ id: 'n2', label: 'Second' })
    const wf: Workflow = {
      id: 'wf-1',
      name: 'Sequential',
      nodes: [node1, node2],
      startNodeId: 'n1',
      createdAt: 0,
      updatedAt: 0,
    }

    const result = await executeWorkflow(wf, 'start', mockExecutor)

    expect(result.success).toBe(true)
    expect(result.steps).toHaveLength(2)
    expect(result.output).toBe('[Second] [First] start')
  })

  it('executes sequential 3-node workflow', async () => {
    const node1 = makeNode({ id: 'n1', label: 'A', nextNodeId: 'n2' })
    const node2 = makeNode({ id: 'n2', label: 'B', nextNodeId: 'n3' })
    const node3 = makeNode({ id: 'n3', label: 'C' })
    const wf: Workflow = {
      id: 'wf-1',
      name: '3-step',
      nodes: [node1, node2, node3],
      startNodeId: 'n1',
      createdAt: 0,
      updatedAt: 0,
    }

    const result = await executeWorkflow(wf, 'x', mockExecutor)

    expect(result.success).toBe(true)
    expect(result.steps).toHaveLength(3)
    expect(result.output).toBe('[C] [B] [A] x')
  })

  it('handles condition node with true branch (contains)', async () => {
    const condNode: WorkflowNode = {
      id: 'cond',
      type: 'condition',
      label: 'Check',
      config: {
        pattern: 'yes',
        mode: 'contains',
        trueBranch: 'true-node',
        falseBranch: 'false-node',
      },
    }
    const trueNode = makeNode({ id: 'true-node', label: 'True Path' })
    const falseNode = makeNode({ id: 'false-node', label: 'False Path' })
    const wf: Workflow = {
      id: 'wf-1',
      name: 'Condition True',
      nodes: [condNode, trueNode, falseNode],
      startNodeId: 'cond',
      createdAt: 0,
      updatedAt: 0,
    }

    const result = await executeWorkflow(wf, 'yes please', mockExecutor)

    expect(result.success).toBe(true)
    expect(result.output).toBe('[True Path] yes please')
  })

  it('handles condition node with false branch (contains)', async () => {
    const condNode: WorkflowNode = {
      id: 'cond',
      type: 'condition',
      label: 'Check',
      config: {
        pattern: 'yes',
        mode: 'contains',
        trueBranch: 'true-node',
        falseBranch: 'false-node',
      },
    }
    const trueNode = makeNode({ id: 'true-node', label: 'True Path' })
    const falseNode = makeNode({ id: 'false-node', label: 'False Path' })
    const wf: Workflow = {
      id: 'wf-1',
      name: 'Condition False',
      nodes: [condNode, trueNode, falseNode],
      startNodeId: 'cond',
      createdAt: 0,
      updatedAt: 0,
    }

    const result = await executeWorkflow(wf, 'no thanks', mockExecutor)

    expect(result.success).toBe(true)
    expect(result.output).toBe('[False Path] no thanks')
  })

  it('handles condition node with regex mode', async () => {
    const condNode: WorkflowNode = {
      id: 'cond',
      type: 'condition',
      label: 'Regex Check',
      config: {
        pattern: '^\\d+$',
        mode: 'regex',
        trueBranch: 'num-node',
        falseBranch: 'text-node',
      },
    }
    const numNode = makeNode({ id: 'num-node', label: 'Number' })
    const textNode = makeNode({ id: 'text-node', label: 'Text' })
    const wf: Workflow = {
      id: 'wf-1',
      name: 'Regex',
      nodes: [condNode, numNode, textNode],
      startNodeId: 'cond',
      createdAt: 0,
      updatedAt: 0,
    }

    const resultNum = await executeWorkflow(wf, '12345', mockExecutor)
    expect(resultNum.output).toBe('[Number] 12345')

    vi.mocked(mockExecutor).mockClear()
    const resultText = await executeWorkflow(wf, 'hello', mockExecutor)
    expect(resultText.output).toBe('[Text] hello')
  })

  it('handles merge node (concatenates inputs)', async () => {
    const mergeNode: WorkflowNode = {
      id: 'merge',
      type: 'merge',
      label: 'Merge',
      config: {},
    }
    const wf: Workflow = {
      id: 'wf-1',
      name: 'Merge',
      nodes: [mergeNode],
      startNodeId: 'merge',
      createdAt: 0,
      updatedAt: 0,
    }

    const result = await executeWorkflow(wf, 'input data', mockExecutor)

    expect(result.success).toBe(true)
    // merge 노드는 입력을 그대로 전달
    expect(result.output).toBe('input data')
  })

  it('handles api_call node via executor', async () => {
    const apiNode: WorkflowNode = {
      id: 'api',
      type: 'api_call',
      label: 'API Call',
      config: { url: 'https://api.example.com', method: 'POST' },
    }
    const wf: Workflow = {
      id: 'wf-1',
      name: 'API',
      nodes: [apiNode],
      startNodeId: 'api',
      createdAt: 0,
      updatedAt: 0,
    }

    const result = await executeWorkflow(wf, 'request', mockExecutor)

    expect(result.success).toBe(true)
    expect(mockExecutor).toHaveBeenCalledWith(apiNode, 'request')
  })

  it('enforces max 20 steps limit', async () => {
    // 순환을 만들어서 무한 루프 유도 (하지만 실행 엔진이 20에서 중단해야 함)
    const nodes: WorkflowNode[] = []
    for (let i = 0; i < 25; i++) {
      nodes.push(makeNode({ id: `n${i}`, label: `Node ${i}`, nextNodeId: `n${i + 1}` }))
    }
    const wf: Workflow = {
      id: 'wf-1',
      name: 'Long',
      nodes,
      startNodeId: 'n0',
      createdAt: 0,
      updatedAt: 0,
    }

    const result = await executeWorkflow(wf, 'start', mockExecutor)

    expect(result.success).toBe(false)
    expect(result.error).toContain('20')
    expect(result.steps.length).toBeLessThanOrEqual(20)
  })

  it('returns error when node execution fails', async () => {
    const failExecutor: NodeExecutor = vi.fn(async () => {
      throw new Error('Node failed')
    })

    const node = makeNode({ id: 'n1', label: 'Fail' })
    const wf: Workflow = {
      id: 'wf-1',
      name: 'Error',
      nodes: [node],
      startNodeId: 'n1',
      createdAt: 0,
      updatedAt: 0,
    }

    const result = await executeWorkflow(wf, 'input', failExecutor)

    expect(result.success).toBe(false)
    expect(result.error).toContain('Node failed')
  })

  it('returns error for missing next node id', async () => {
    const node = makeNode({ id: 'n1', label: 'Orphan', nextNodeId: 'missing' })
    const wf: Workflow = {
      id: 'wf-1',
      name: 'Missing',
      nodes: [node],
      startNodeId: 'n1',
      createdAt: 0,
      updatedAt: 0,
    }

    const result = await executeWorkflow(wf, 'input', mockExecutor)

    expect(result.success).toBe(false)
    expect(result.error).toContain('missing')
  })

  it('records durationMs for each step', async () => {
    const node = makeNode({ id: 'n1', label: 'Timed' })
    const wf: Workflow = {
      id: 'wf-1',
      name: 'Duration',
      nodes: [node],
      startNodeId: 'n1',
      createdAt: 0,
      updatedAt: 0,
    }

    const result = await executeWorkflow(wf, 'input', mockExecutor)

    expect(result.steps[0].durationMs).toBeGreaterThanOrEqual(0)
  })
})

// --- Export/Import ---

describe('exportWorkflows', () => {
  it('exports all workflows as JSON', async () => {
    await saveWorkflow(makeWorkflow({ name: 'Export 1' }))
    await saveWorkflow(makeWorkflow({ name: 'Export 2' }))

    const json = await exportWorkflows()
    const parsed = JSON.parse(json)

    expect(parsed.version).toBe(1)
    expect(parsed.workflows).toHaveLength(2)
    expect(parsed.exportedAt).toBeTruthy()
  })

  it('exports empty array when no workflows', async () => {
    const json = await exportWorkflows()
    const parsed = JSON.parse(json)

    expect(parsed.workflows).toHaveLength(0)
  })
})

describe('importWorkflows', () => {
  it('imports workflows from JSON and returns count', async () => {
    await saveWorkflow(makeWorkflow({ name: 'Existing' }))

    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      workflows: [
        { ...makeWorkflow({ name: 'New 1' }), id: 'wf-old-1', createdAt: 0, updatedAt: 0 },
        { ...makeWorkflow({ name: 'New 2' }), id: 'wf-old-2', createdAt: 0, updatedAt: 0 },
      ],
    }

    const count = await importWorkflows(JSON.stringify(exportData))

    expect(count).toBe(2)
    const list = await getWorkflows()
    expect(list).toHaveLength(3)
  })

  it('skips duplicates by name', async () => {
    await saveWorkflow(makeWorkflow({ name: 'Dup' }))

    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      workflows: [
        { ...makeWorkflow({ name: 'Dup' }), id: 'wf-old', createdAt: 0, updatedAt: 0 },
        { ...makeWorkflow({ name: 'Fresh' }), id: 'wf-old-2', createdAt: 0, updatedAt: 0 },
      ],
    }

    const count = await importWorkflows(JSON.stringify(exportData))
    expect(count).toBe(1)
  })

  it('throws on invalid JSON', async () => {
    await expect(importWorkflows('not json')).rejects.toThrow()
  })

  it('throws on invalid format', async () => {
    await expect(importWorkflows(JSON.stringify({ foo: 'bar' }))).rejects.toThrow()
  })

  it('round-trips via export then import', async () => {
    await saveWorkflow(makeWorkflow({ name: 'Round Trip' }))

    const json = await exportWorkflows()
    await chrome.storage.local.clear()

    const count = await importWorkflows(json)
    expect(count).toBe(1)

    const list = await getWorkflows()
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Round Trip')
  })

  it('stops importing when max workflows reached', async () => {
    for (let i = 0; i < 19; i++) {
      await saveWorkflow(makeWorkflow({ name: `Existing ${i}` }))
    }

    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      workflows: [
        { ...makeWorkflow({ name: 'Import 1' }), id: 'wf-i1', createdAt: 0, updatedAt: 0 },
        { ...makeWorkflow({ name: 'Import 2' }), id: 'wf-i2', createdAt: 0, updatedAt: 0 },
      ],
    }

    const count = await importWorkflows(JSON.stringify(exportData))
    expect(count).toBe(1) // only 1 fits (19 + 1 = 20 max)
  })
})

// --- validateWorkflow with condition branches ---

describe('validateWorkflow condition branch reachability', () => {
  it('validates workflow with condition node and all branches reachable', () => {
    const condNode: WorkflowNode = {
      id: 'cond',
      type: 'condition',
      label: 'Condition',
      config: {
        pattern: 'test',
        mode: 'contains',
        trueBranch: 'true-node',
        falseBranch: 'false-node',
      },
    }
    const trueNode = makeNode({ id: 'true-node', label: 'True' })
    const falseNode = makeNode({ id: 'false-node', label: 'False' })
    const wf: Workflow = {
      id: 'wf-1',
      name: 'Cond Valid',
      nodes: [condNode, trueNode, falseNode],
      startNodeId: 'cond',
      createdAt: 0,
      updatedAt: 0,
    }

    const result = validateWorkflow(wf)
    expect(result.valid).toBe(true)
  })

  it('detects disconnected nodes with condition having only trueBranch used', () => {
    const condNode: WorkflowNode = {
      id: 'cond',
      type: 'condition',
      label: 'Condition',
      config: {
        pattern: 'test',
        mode: 'contains',
        trueBranch: 'true-node',
        falseBranch: 'false-node',
      },
    }
    const trueNode = makeNode({ id: 'true-node', label: 'True' })
    const falseNode = makeNode({ id: 'false-node', label: 'False' })
    const orphanNode = makeNode({ id: 'orphan', label: 'Orphan' })
    const wf: Workflow = {
      id: 'wf-1',
      name: 'Disconnected',
      nodes: [condNode, trueNode, falseNode, orphanNode],
      startNodeId: 'cond',
      createdAt: 0,
      updatedAt: 0,
    }

    const result = validateWorkflow(wf)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('orphan'))).toBe(true)
  })

  it('detects cycle in condition branches', () => {
    const condNode: WorkflowNode = {
      id: 'cond',
      type: 'condition',
      label: 'Condition',
      config: {
        pattern: 'test',
        mode: 'contains',
        trueBranch: 'n1',
        falseBranch: 'n2',
      },
    }
    const n1 = makeNode({ id: 'n1', label: 'N1', nextNodeId: 'cond' }) // cycle back
    const n2 = makeNode({ id: 'n2', label: 'N2' })
    const wf: Workflow = {
      id: 'wf-1',
      name: 'Cycle Cond',
      nodes: [condNode, n1, n2],
      startNodeId: 'cond',
      createdAt: 0,
      updatedAt: 0,
    }

    const result = validateWorkflow(wf)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('순환'))).toBe(true)
  })
})

// --- executeWorkflow with invalid regex ---

describe('executeWorkflow condition regex edge cases', () => {
  const mockExecutor: NodeExecutor = vi.fn(async (_node, input) => input)

  it('handles invalid regex pattern gracefully (evaluates to false)', async () => {
    const condNode: WorkflowNode = {
      id: 'cond',
      type: 'condition',
      label: 'Bad Regex',
      config: {
        pattern: '[invalid',
        mode: 'regex',
        trueBranch: 'true-node',
        falseBranch: 'false-node',
      },
    }
    const trueNode = makeNode({ id: 'true-node', label: 'True' })
    const falseNode = makeNode({ id: 'false-node', label: 'False' })
    const wf: Workflow = {
      id: 'wf-1',
      name: 'Bad Regex',
      nodes: [condNode, trueNode, falseNode],
      startNodeId: 'cond',
      createdAt: 0,
      updatedAt: 0,
    }

    const result = await executeWorkflow(wf, 'input', mockExecutor)
    expect(result.success).toBe(true)
    // Invalid regex should fallback to false
    expect(result.steps[0].output).toBe('false')
  })
})
