// components/WorkflowEditor.tsx — 워크플로우 에디터 (노드 기반 AI 파이프라인)

import { useState, useEffect, useCallback } from 'react'
import { useLocale } from '../i18n'
import {
  getWorkflows,
  saveWorkflow,
  deleteWorkflow,
  validateWorkflow,
  executeWorkflow,
  exportWorkflows,
  importWorkflows,
} from '../lib/workflowBuilder'
import type {
  Workflow,
  WorkflowNode,
  NodeType,
  ValidationResult,
  WorkflowResult,
} from '../lib/workflowBuilder'

interface WorkflowEditorProps {
  onClose: () => void
}

type EditorMode = 'list' | 'edit'

function createNodeId(type: NodeType, index: number): string {
  return `${type}-${index}`
}

function buildDefaultConfig(type: NodeType): Record<string, unknown> {
  if (type === 'condition') {
    return { pattern: '', mode: 'contains', trueBranch: '', falseBranch: '' }
  }
  return {}
}

export function WorkflowEditor({ onClose }: WorkflowEditorProps) {
  const { t } = useLocale()

  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [mode, setMode] = useState<EditorMode>('list')
  const [editingName, setEditingName] = useState('')
  const [nodes, setNodes] = useState<WorkflowNode[]>([])
  const [nodeCounter, setNodeCounter] = useState(0)
  const [newNodeType, setNewNodeType] = useState<NodeType>('ai_call')
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [executionResult, setExecutionResult] = useState<WorkflowResult | null>(null)
  const [inputText, setInputText] = useState('')
  const [isRunning, setIsRunning] = useState(false)

  const loadList = useCallback(async () => {
    const list = await getWorkflows()
    setWorkflows(list)
  }, [])

  useEffect(() => {
    loadList()
  }, [loadList])

  const handleCreate = useCallback(() => {
    setMode('edit')
    setEditingName('')
    setNodes([])
    setNodeCounter(0)
    setValidationResult(null)
    setExecutionResult(null)
    setInputText('')
  }, [])

  const handleEdit = useCallback((wf: Workflow) => {
    setMode('edit')
    setEditingName(wf.name)
    setNodes(wf.nodes)
    setNodeCounter(wf.nodes.length)
    setValidationResult(null)
    setExecutionResult(null)
  }, [])

  const handleAddNode = useCallback(() => {
    const nextIdx = nodeCounter + 1
    const id = createNodeId(newNodeType, nextIdx)
    const newNode: WorkflowNode = {
      id,
      type: newNodeType,
      label: id,
      config: buildDefaultConfig(newNodeType),
    }
    setNodes((prev) => [...prev, newNode])
    setNodeCounter(nextIdx)
  }, [newNodeType, nodeCounter])

  const handleRemoveNode = useCallback((nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId))
  }, [])

  const handleNodeConfigChange = useCallback(
    (nodeId: string, key: string, value: unknown) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId
            ? { ...n, config: { ...n.config, [key]: value } }
            : n,
        ),
      )
    },
    [],
  )

  const handleNextNodeChange = useCallback((nodeId: string, nextId: string) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === nodeId ? { ...n, nextNodeId: nextId || undefined } : n,
      ),
    )
  }, [])

  const buildWorkflow = useCallback((): Workflow => {
    return {
      id: '',
      name: editingName || 'Untitled',
      nodes,
      startNodeId: nodes.length > 0 ? nodes[0].id : '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
  }, [editingName, nodes])

  const handleValidate = useCallback(() => {
    const wf = buildWorkflow()
    const result = validateWorkflow(wf)
    setValidationResult(result)
  }, [buildWorkflow])

  const handleRun = useCallback(async () => {
    const wf = buildWorkflow()
    setIsRunning(true)
    setExecutionResult(null)
    try {
      const result = await executeWorkflow(wf, inputText, async (node, input) => {
        return `[${node.type}] processed: ${input}`
      })
      setExecutionResult(result)
    } catch (error) {
      setExecutionResult({
        success: false,
        output: '',
        steps: [],
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setIsRunning(false)
    }
  }, [buildWorkflow, inputText])

  const handleSave = useCallback(async () => {
    const wf = buildWorkflow()
    await saveWorkflow({
      name: wf.name,
      nodes: wf.nodes,
      startNodeId: wf.startNodeId,
    })
    await loadList()
    setMode('list')
  }, [buildWorkflow, loadList])

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteWorkflow(id)
      await loadList()
    },
    [loadList],
  )

  const handleExport = useCallback(async () => {
    const json = await exportWorkflows()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'workflows.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const handleImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        await importWorkflows(text)
        await loadList()
      } catch {
        // import error silently handled
      }
    },
    [loadList],
  )

  const renderNodeConfig = (node: WorkflowNode) => {
    if (node.type === 'condition') {
      const config = node.config as Record<string, string>
      return (
        <div className="workflow-node-config">
          <input
            type="text"
            placeholder="pattern"
            value={config.pattern ?? ''}
            onChange={(e) => handleNodeConfigChange(node.id, 'pattern', e.target.value)}
          />
          <select
            value={config.mode ?? 'contains'}
            onChange={(e) => handleNodeConfigChange(node.id, 'mode', e.target.value)}
          >
            <option value="contains">contains</option>
            <option value="regex">regex</option>
          </select>
          <select
            value={config.trueBranch ?? ''}
            onChange={(e) => handleNodeConfigChange(node.id, 'trueBranch', e.target.value)}
          >
            <option value="">--trueBranch--</option>
            {nodes.filter((n) => n.id !== node.id).map((n) => (
              <option key={n.id} value={n.id}>{n.id}</option>
            ))}
          </select>
          <select
            value={config.falseBranch ?? ''}
            onChange={(e) => handleNodeConfigChange(node.id, 'falseBranch', e.target.value)}
          >
            <option value="">--falseBranch--</option>
            {nodes.filter((n) => n.id !== node.id).map((n) => (
              <option key={n.id} value={n.id}>{n.id}</option>
            ))}
          </select>
        </div>
      )
    }

    return (
      <div className="workflow-node-config">
        <select
          value={node.nextNodeId ?? ''}
          onChange={(e) => handleNextNodeChange(node.id, e.target.value)}
        >
          <option value="">--nextNode--</option>
          {nodes.filter((n) => n.id !== node.id).map((n) => (
            <option key={n.id} value={n.id}>{n.id}</option>
          ))}
        </select>
      </div>
    )
  }

  if (mode === 'edit') {
    return (
      <div className="workflow-editor">
        <div className="workflow-header">
          <h3>{t('workflow.title')}</h3>
          <button onClick={onClose}>{t('common.close')}</button>
        </div>

        <input
          type="text"
          className="workflow-name-input"
          value={editingName}
          onChange={(e) => setEditingName(e.target.value)}
          placeholder="Workflow name"
        />

        <div className="workflow-toolbar">
          <select
            value={newNodeType}
            onChange={(e) => setNewNodeType(e.target.value as NodeType)}
          >
            <option value="ai_call">ai_call</option>
            <option value="condition">condition</option>
            <option value="merge">merge</option>
            <option value="api_call">api_call</option>
          </select>
          <button onClick={handleAddNode}>{t('workflow.addNode')}</button>
          <button onClick={handleValidate}>{t('workflow.validate')}</button>
          <button onClick={handleSave}>{t('common.save')}</button>
        </div>

        <div className="workflow-nodes">
          {nodes.map((node) => (
            <div key={node.id} className="workflow-node-item">
              <div className="workflow-node-header">
                <span>{node.id}</span>
                <span className="workflow-node-type">{node.type}</span>
                <button onClick={() => handleRemoveNode(node.id)}>
                  {t('workflow.removeNode')}
                </button>
              </div>
              {renderNodeConfig(node)}
            </div>
          ))}
        </div>

        {validationResult && !validationResult.valid && (
          <div className="workflow-errors">
            {validationResult.errors.map((err, i) => (
              <div key={i} className="workflow-error-item">{err}</div>
            ))}
          </div>
        )}

        <div className="workflow-run-section">
          <input
            type="text"
            placeholder={t('workflow.input')}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <button onClick={handleRun} disabled={isRunning}>
            {t('workflow.run')}
          </button>
        </div>

        {executionResult && (
          <div className="workflow-result">
            <div className="workflow-result-label">{t('workflow.result')}</div>
            <div className="workflow-result-output">
              {executionResult.success
                ? executionResult.output
                : executionResult.error}
            </div>
          </div>
        )}
      </div>
    )
  }

  // List mode
  return (
    <div className="workflow-editor">
      <div className="workflow-header">
        <h3>{t('workflow.title')}</h3>
        <button onClick={onClose}>{t('common.close')}</button>
      </div>

      <div className="workflow-toolbar">
        <button onClick={handleCreate}>{t('workflow.create')}</button>
        <button onClick={handleExport}>{t('workflow.export')}</button>
        <label className="workflow-import-label">
          {t('workflow.import')}
          <input type="file" accept=".json" onChange={handleImport} hidden />
        </label>
      </div>

      <div className="workflow-list">
        {workflows.map((wf) => (
          <div key={wf.id} className="workflow-list-item">
            <span className="workflow-item-name">{wf.name}</span>
            <div className="workflow-item-actions">
              <button onClick={() => handleEdit(wf)}>{t('common.edit')}</button>
              <button onClick={() => handleDelete(wf.id)}>{t('common.delete')}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
