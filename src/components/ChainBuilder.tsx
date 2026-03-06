import { useState, useEffect, useCallback } from 'react'
import { t } from '../i18n'
import type { Config } from '../types'
import {
  getChains,
  saveChain,
  deleteChain,
  exportChains,
  importChains,
  type AssistantChain,
  type ChainStep,
} from '../lib/assistantChain'
import { getAssistants } from '../lib/assistantBuilder'

interface ChainBuilderProps {
  config: Config
  onClose: () => void
  onRunChain?: (chainId: string) => void
}

export default function ChainBuilder({ config, onClose, onRunChain }: ChainBuilderProps) {
  const [chains, setChains] = useState<AssistantChain[]>([])
  const [assistants, setAssistants] = useState<Array<{ id: string; name: string; icon: string }>>([])
  const [editingChain, setEditingChain] = useState<AssistantChain | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const loadAssistants = useCallback(async () => {
    const loaded = await getAssistants(config)
    setAssistants(loaded)
  }, [config])

  useEffect(() => {
    loadChains()
    loadAssistants()
  }, [loadAssistants])

  const loadChains = async () => {
    const loaded = await getChains()
    setChains(loaded)
  }


  const handleCreate = () => {
    setEditingChain({
      id: '',
      name: '',
      steps: [
        { assistantId: '', promptTemplate: '' },
        { assistantId: '', promptTemplate: '' },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    setIsCreating(true)
  }

  const handleEdit = (chain: AssistantChain) => {
    setEditingChain({ ...chain })
    setIsCreating(false)
  }

  const handleSave = async () => {
    if (!editingChain || !editingChain.name) return

    await saveChain({
      name: editingChain.name,
      steps: editingChain.steps,
    })

    await loadChains()
    setEditingChain(null)
    setIsCreating(false)
  }

  const handleDelete = async (id: string) => {
    await deleteChain(id)
    await loadChains()
    setConfirmDelete(null)
  }

  const handleExport = async () => {
    const json = await exportChains()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `assistant-chains-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const text = await file.text()
      await importChains(text)
      await loadChains()
    }
    input.click()
  }

  const handleAddStep = () => {
    if (!editingChain || editingChain.steps.length >= 10) return
    setEditingChain({
      ...editingChain,
      steps: [...editingChain.steps, { assistantId: '', promptTemplate: '' }],
    })
  }

  const handleRemoveStep = (index: number) => {
    if (!editingChain || editingChain.steps.length <= 2) return
    setEditingChain({
      ...editingChain,
      steps: editingChain.steps.filter((_, i) => i !== index),
    })
  }

  const updateStep = (index: number, field: keyof ChainStep, value: string) => {
    if (!editingChain) return
    const newSteps = [...editingChain.steps]
    newSteps[index] = { ...newSteps[index], [field]: value }
    setEditingChain({ ...editingChain, steps: newSteps })
  }

  if (editingChain) {
    return (
      <div className="chain-builder-edit">
        <div className="header">
          <h3>{isCreating ? t('chain.create') : t('common.edit')}</h3>
          <button onClick={() => { setEditingChain(null); setIsCreating(false) }}>
            {t('common.cancel')}
          </button>
        </div>

        <div className="form">
          <input
            type="text"
            placeholder="체인 이름"
            value={editingChain.name}
            onChange={(e) => setEditingChain({ ...editingChain, name: e.target.value })}
          />

          <div className="steps">
            {editingChain.steps.map((step, index) => (
              <div key={index} className="step">
                <div className="step-header">
                  <span>Step {index + 1}</span>
                  <button
                    onClick={() => handleRemoveStep(index)}
                    disabled={editingChain.steps.length <= 2}
                  >
                    {t('chain.removeStep')}
                  </button>
                </div>

                <select
                  value={step.assistantId}
                  onChange={(e) => updateStep(index, 'assistantId', e.target.value)}
                >
                  <option value="">{t('chain.selectAssistant')}</option>
                  {assistants.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.icon} {a.name}
                    </option>
                  ))}
                </select>

                <textarea
                  placeholder={`${t('chain.promptTemplate')} ({{input}}, {{original}})`}
                  value={step.promptTemplate}
                  onChange={(e) => updateStep(index, 'promptTemplate', e.target.value)}
                />
              </div>
            ))}
          </div>

          <button
            onClick={handleAddStep}
            disabled={editingChain.steps.length >= 10}
          >
            {t('chain.addStep')}
          </button>

          <div className="actions">
            <button onClick={handleSave}>{t('common.save')}</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="chain-builder">
      <div className="header">
        <h3>{t('chain.title')}</h3>
        <button onClick={onClose}>{t('common.close')}</button>
      </div>

      <div className="toolbar">
        <button onClick={handleCreate}>{t('chain.create')}</button>
        <button onClick={handleExport}>{t('chain.exportAll')}</button>
        <button onClick={handleImport}>{t('chain.import')}</button>
      </div>

      <div className="chain-list">
        {chains.map((chain) => (
          <div key={chain.id} className="chain-item">
            {confirmDelete === chain.id ? (
              <div className="confirm-delete">
                <span>삭제하시겠습니까?</span>
                <button onClick={() => handleDelete(chain.id)}>{t('common.confirm')}</button>
                <button onClick={() => setConfirmDelete(null)}>{t('common.cancel')}</button>
              </div>
            ) : (
              <>
                <div className="chain-info">
                  <h4>{chain.name}</h4>
                  <span>{chain.steps.length} steps</span>
                </div>
                <div className="chain-actions">
                  {onRunChain && (
                    <button onClick={() => onRunChain(chain.id)}>{t('chain.run')}</button>
                  )}
                  <button onClick={() => handleEdit(chain)}>{t('common.edit')}</button>
                  <button onClick={() => setConfirmDelete(chain.id)}>{t('common.delete')}</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}