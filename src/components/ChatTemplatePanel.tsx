import { useState, useEffect } from 'react'
import { useLocale } from '../i18n'
import { ChatTemplateStore, type ChatTemplate, type ChatTemplateStep } from '../lib/chatTemplates'

interface ChatTemplatePanelProps {
  onClose: () => void
  onRunTemplate: (templateId: string, variables: Record<string, string>) => void
}

export function ChatTemplatePanel({ onClose, onRunTemplate }: ChatTemplatePanelProps) {
  const { t } = useLocale()
  const [templates, setTemplates] = useState<ChatTemplate[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [variableValues, setVariableValues] = useState<Record<string, string>>({})
  const [showVariables, setShowVariables] = useState(false)

  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formCategory, setFormCategory] = useState('일반')
  const [formSteps, setFormSteps] = useState<ChatTemplateStep[]>([
    { role: 'user', content: '', waitForResponse: true },
  ])

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    const list = await ChatTemplateStore.list()
    setTemplates(list)
  }

  const handleCreate = () => {
    setIsCreating(true)
    setFormName('')
    setFormDescription('')
    setFormCategory('일반')
    setFormSteps([{ role: 'user', content: '', waitForResponse: true }])
  }

  const handleSave = async () => {
    if (!formName.trim()) return

    await ChatTemplateStore.save({
      name: formName,
      description: formDescription,
      steps: formSteps,
      category: formCategory,
    })

    setIsCreating(false)
    loadTemplates()
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('chatTemplateDelete'))) return
    await ChatTemplateStore.delete(id)
    loadTemplates()
    if (selectedId === id) {
      setSelectedId(null)
    }
  }

  const handleRun = (template: ChatTemplate) => {
    if (template.variables.length > 0) {
      setSelectedId(template.id)
      setShowVariables(true)
      const initialValues: Record<string, string> = {}
      for (const v of template.variables) {
        initialValues[v] = ''
      }
      setVariableValues(initialValues)
    } else {
      onRunTemplate(template.id, {})
      onClose()
    }
  }

  const handleExecuteWithVariables = () => {
    if (!selectedId) return
    onRunTemplate(selectedId, variableValues)
    setShowVariables(false)
    setSelectedId(null)
    onClose()
  }

  const handleAddStep = () => {
    setFormSteps([...formSteps, { role: 'user', content: '', waitForResponse: true }])
  }

  const handleRemoveStep = (index: number) => {
    setFormSteps(formSteps.filter((_, i) => i !== index))
  }

  const handleStepChange = (index: number, field: keyof ChatTemplateStep, value: unknown) => {
    const updated = [...formSteps]
    updated[index] = { ...updated[index], [field]: value }
    setFormSteps(updated)
  }

  const handleExport = async () => {
    const json = await ChatTemplateStore.exportTemplates()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat-templates-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const text = await file.text()
      try {
        const result = await ChatTemplateStore.importTemplates(text)
        alert(t('chatTemplateImportSuccess', { imported: result.imported, skipped: result.skipped }))
        loadTemplates()
      } catch (err) {
        alert(String(err))
      }
    }
    input.click()
  }

  if (showVariables && selectedId) {
    const template = templates.find((t) => t.id === selectedId)
    if (!template) return null

    return (
      <div className="chat-template-panel">
        <div className="panel-header">
          <h3>{template.name}</h3>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="panel-body">
          <p>{t('chatTemplateVariable')}</p>
          {template.variables.map((v) => (
            <div key={v} style={{ marginBottom: '8px' }}>
              <label>{v}</label>
              <input
                type="text"
                value={variableValues[v] ?? ''}
                onChange={(e) => setVariableValues({ ...variableValues, [v]: e.target.value })}
                style={{ width: '100%', padding: '4px', marginTop: '4px' }}
              />
            </div>
          ))}
          <button className="btn btn-primary" onClick={handleExecuteWithVariables} style={{ marginTop: '12px' }}>
            {t('chatTemplateRun')}
          </button>
        </div>
      </div>
    )
  }

  if (isCreating) {
    return (
      <div className="chat-template-panel">
        <div className="panel-header">
          <h3>{t('chatTemplateNew')}</h3>
          <button className="icon-btn" onClick={() => setIsCreating(false)}>✕</button>
        </div>
        <div className="panel-body">
          <label>{t('chatTemplateName')}</label>
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            style={{ width: '100%', padding: '4px', marginBottom: '8px' }}
          />

          <label>{t('chatTemplateCategory')}</label>
          <input
            type="text"
            value={formCategory}
            onChange={(e) => setFormCategory(e.target.value)}
            style={{ width: '100%', padding: '4px', marginBottom: '8px' }}
          />

          <label>{t('chatTemplateSteps')}</label>
          {formSteps.map((step, idx) => (
            <div key={idx} style={{ border: '1px solid #ccc', padding: '8px', marginBottom: '8px' }}>
              <select
                value={step.role}
                onChange={(e) => handleStepChange(idx, 'role', e.target.value)}
                style={{ marginBottom: '4px' }}
              >
                <option value="user">User</option>
                <option value="system">System</option>
              </select>
              <textarea
                value={step.content}
                onChange={(e) => handleStepChange(idx, 'content', e.target.value)}
                rows={3}
                style={{ width: '100%', padding: '4px', marginBottom: '4px' }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="checkbox"
                  checked={step.waitForResponse}
                  onChange={(e) => handleStepChange(idx, 'waitForResponse', e.target.checked)}
                />
                {t('chatTemplateWaitResponse')}
              </label>
              <button className="btn btn-sm" onClick={() => handleRemoveStep(idx)}>
                {t('chatTemplateDelete')}
              </button>
            </div>
          ))}
          <button className="btn btn-sm" onClick={handleAddStep}>
            {t('chatTemplateAddStep')}
          </button>

          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary" onClick={handleSave}>
              {t('common.save')}
            </button>
            <button className="btn" onClick={() => setIsCreating(false)}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-template-panel">
      <div className="panel-header">
        <h3>{t('chatTemplate')}</h3>
        <button className="icon-btn" onClick={onClose}>✕</button>
      </div>
      <div className="panel-body">
        <div style={{ marginBottom: '12px', display: 'flex', gap: '8px' }}>
          <button className="btn btn-sm btn-primary" onClick={handleCreate}>
            {t('chatTemplateNew')}
          </button>
          <button className="btn btn-sm" onClick={handleExport}>
            {t('chatTemplateExport')}
          </button>
          <button className="btn btn-sm" onClick={handleImport}>
            {t('chatTemplateImport')}
          </button>
        </div>

        {templates.length === 0 ? (
          <p>{t('chatTemplateEmpty')}</p>
        ) : (
          <div>
            {templates.map((template) => (
              <div key={template.id} style={{ border: '1px solid #ccc', padding: '8px', marginBottom: '8px' }}>
                <div style={{ fontWeight: 'bold' }}>{template.name}</div>
                <div style={{ fontSize: '0.9em', color: '#666' }}>{template.description}</div>
                <div style={{ fontSize: '0.85em', marginTop: '4px' }}>
                  {template.steps.length} {t('chatTemplateSteps')} • {template.category} • {template.usageCount} uses
                </div>
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                  <button className="btn btn-sm btn-primary" onClick={() => handleRun(template)}>
                    {t('chatTemplateRun')}
                  </button>
                  <button className="btn btn-sm" onClick={() => handleDelete(template.id)}>
                    {t('chatTemplateDelete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
