// lib/workflowBuilder.ts — 워크플로우 빌더 (노드 기반 AI 파이프라인)

import { Storage } from './storage'
import { SK } from './storageKeys'

const STORAGE_KEY = SK.WORKFLOWS
const MAX_WORKFLOWS = 20
const MAX_STEPS = 20

// --- Types ---

export type NodeType = 'ai_call' | 'condition' | 'merge' | 'api_call'

export interface WorkflowNode {
  id: string
  type: NodeType
  label: string
  config: Record<string, unknown>
  nextNodeId?: string
}

export interface ConditionConfig {
  pattern: string
  mode: 'contains' | 'regex'
  trueBranch: string
  falseBranch: string
}

export interface Workflow {
  id: string
  name: string
  nodes: WorkflowNode[]
  startNodeId: string
  createdAt: number
  updatedAt: number
}

export interface WorkflowResult {
  success: boolean
  output: string
  steps: WorkflowStep[]
  error?: string
}

export interface WorkflowStep {
  nodeId: string
  output: string
  durationMs: number
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export type NodeExecutor = (node: WorkflowNode, input: string) => Promise<string>

// --- Helpers ---

function generateId(): string {
  return `wf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

async function loadWorkflows(): Promise<Workflow[]> {
  return (await Storage.get<Workflow[]>(STORAGE_KEY)) ?? []
}

async function persistWorkflows(workflows: Workflow[]): Promise<void> {
  await Storage.set(STORAGE_KEY, workflows)
}

function evaluateCondition(input: string, config: ConditionConfig): boolean {
  if (config.mode === 'contains') {
    return input.includes(config.pattern)
  }
  // regex
  try {
    const regex = new RegExp(config.pattern)
    return regex.test(input)
  } catch {
    return false
  }
}

function collectReachable(
  startId: string,
  nodeMap: Map<string, WorkflowNode>,
): Set<string> {
  const visited = new Set<string>()
  const queue = [startId]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)

    const node = nodeMap.get(current)
    if (!node) continue

    if (node.nextNodeId && !visited.has(node.nextNodeId)) {
      queue.push(node.nextNodeId)
    }

    if (node.type === 'condition') {
      const cfg = node.config as unknown as ConditionConfig
      if (cfg.trueBranch && !visited.has(cfg.trueBranch)) {
        queue.push(cfg.trueBranch)
      }
      if (cfg.falseBranch && !visited.has(cfg.falseBranch)) {
        queue.push(cfg.falseBranch)
      }
    }
  }

  return visited
}

function detectCycle(
  startId: string,
  nodeMap: Map<string, WorkflowNode>,
): boolean {
  const visited = new Set<string>()
  const stack = new Set<string>()

  function dfs(nodeId: string): boolean {
    if (stack.has(nodeId)) return true
    if (visited.has(nodeId)) return false

    visited.add(nodeId)
    stack.add(nodeId)

    const node = nodeMap.get(nodeId)
    if (node) {
      const neighbors: string[] = []
      if (node.nextNodeId) neighbors.push(node.nextNodeId)
      if (node.type === 'condition') {
        const cfg = node.config as unknown as ConditionConfig
        if (cfg.trueBranch) neighbors.push(cfg.trueBranch)
        if (cfg.falseBranch) neighbors.push(cfg.falseBranch)
      }

      for (const next of neighbors) {
        if (dfs(next)) return true
      }
    }

    stack.delete(nodeId)
    return false
  }

  return dfs(startId)
}

// --- CRUD ---

export async function getWorkflows(): Promise<Workflow[]> {
  return loadWorkflows()
}

export async function saveWorkflow(
  wf: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Workflow> {
  const workflows = await loadWorkflows()

  if (workflows.length >= MAX_WORKFLOWS) {
    workflows.shift()
  }

  const now = Date.now()
  const newWf: Workflow = {
    ...wf,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  }

  await persistWorkflows([...workflows, newWf])
  return newWf
}

export async function deleteWorkflow(id: string): Promise<void> {
  const workflows = await loadWorkflows()
  const filtered = workflows.filter((w) => w.id !== id)
  await persistWorkflows(filtered)
}

// --- Validation ---

export function validateWorkflow(workflow: Workflow): ValidationResult {
  const errors: string[] = []

  if (workflow.nodes.length === 0) {
    errors.push('최소 1개의 노드가 필요합니다')
    return { valid: false, errors }
  }

  const nodeMap = new Map(workflow.nodes.map((n) => [n.id, n]))

  if (!nodeMap.has(workflow.startNodeId)) {
    errors.push(`시작 노드 "${workflow.startNodeId}"를 찾을 수 없습니다`)
  }

  // 연결되지 않은 노드 감지
  const reachable = collectReachable(workflow.startNodeId, nodeMap)
  const disconnected = workflow.nodes.filter((n) => !reachable.has(n.id))
  if (disconnected.length > 0) {
    const ids = disconnected.map((n) => n.id).join(', ')
    errors.push(`연결되지 않은 노드가 있습니다: ${ids}`)
  }

  // 순환 감지
  if (detectCycle(workflow.startNodeId, nodeMap)) {
    errors.push('워크플로우에 순환이 감지되었습니다')
  }

  return { valid: errors.length === 0, errors }
}

// --- Execution ---

export async function executeWorkflow(
  workflow: Workflow,
  initialInput: string,
  executor: NodeExecutor,
): Promise<WorkflowResult> {
  const nodeMap = new Map(workflow.nodes.map((n) => [n.id, n]))
  const steps: WorkflowStep[] = []
  let currentNodeId: string | undefined = workflow.startNodeId
  let currentInput = initialInput

  try {
    while (currentNodeId) {
      if (steps.length >= MAX_STEPS) {
        return {
          success: false,
          output: currentInput,
          steps,
          error: `최대 실행 스텝(${MAX_STEPS})을 초과했습니다`,
        }
      }

      const node = nodeMap.get(currentNodeId)
      if (!node) {
        return {
          success: false,
          output: currentInput,
          steps,
          error: `노드를 찾을 수 없습니다: ${currentNodeId}`,
        }
      }

      if (node.type === 'condition') {
        const cfg = node.config as unknown as ConditionConfig
        const matched = evaluateCondition(currentInput, cfg)

        steps.push({
          nodeId: node.id,
          output: matched ? 'true' : 'false',
          durationMs: 0,
        })

        currentNodeId = matched ? cfg.trueBranch : cfg.falseBranch
      } else if (node.type === 'merge') {
        // merge 노드: 입력을 그대로 전달
        steps.push({
          nodeId: node.id,
          output: currentInput,
          durationMs: 0,
        })
        currentNodeId = node.nextNodeId
      } else {
        // ai_call, api_call: executor에 위임
        const startMs = Date.now()
        const output = await executor(node, currentInput)
        const durationMs = Date.now() - startMs

        steps.push({ nodeId: node.id, output, durationMs })
        currentInput = output
        currentNodeId = node.nextNodeId
      }
    }

    return { success: true, output: currentInput, steps }
  } catch (error) {
    return {
      success: false,
      output: currentInput,
      steps,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// --- Export/Import ---

export async function exportWorkflows(): Promise<string> {
  const workflows = await loadWorkflows()
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      workflows,
    },
    null,
    2,
  )
}

export async function importWorkflows(json: string): Promise<number> {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('유효하지 않은 JSON 형식입니다')
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('version' in parsed) ||
    !('workflows' in parsed) ||
    !Array.isArray((parsed as { workflows: unknown }).workflows)
  ) {
    throw new Error('유효하지 않은 워크플로우 내보내기 형식입니다')
  }

  const data = parsed as { version: number; workflows: Workflow[] }
  const existing = await loadWorkflows()
  const existingNames = new Set(existing.map((w) => w.name))

  let imported = 0

  for (const wf of data.workflows) {
    if (existingNames.has(wf.name)) continue
    if (existing.length + imported >= MAX_WORKFLOWS) break

    existing.push({
      ...wf,
      id: generateId(),
    })
    imported++
  }

  await persistWorkflows(existing)
  return imported
}
