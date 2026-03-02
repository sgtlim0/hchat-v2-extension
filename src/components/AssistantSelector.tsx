import { useState, useEffect } from 'react'
import { AssistantRegistry, type CustomAssistant } from '../lib/assistantBuilder'
import { useLocale } from '../i18n'

interface Props {
  value: string
  onChange: (assistantId: string) => void
  onCreateNew?: () => void
}

function modelBadge(model: string): string {
  if (!model) return ''
  if (model.includes('sonnet')) return 'Sonnet'
  if (model.includes('opus')) return 'Opus'
  if (model.includes('haiku')) return 'Haiku'
  if (model.includes('gpt-4')) return 'GPT-4'
  if (model.includes('gpt-3')) return 'GPT-3.5'
  if (model.includes('gemini')) return 'Gemini'
  return model.split('/').pop()?.split('.').pop() ?? ''
}

export function AssistantSelector({ value, onChange, onCreateNew: _onCreateNew }: Props) {
  const { t } = useLocale()
  const [assistants, setAssistants] = useState<CustomAssistant[]>([])
  const [showList, setShowList] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('\u{1F9D1}')
  const [newPrompt, setNewPrompt] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newModel, setNewModel] = useState('')
  const [newCategory, setNewCategory] = useState('')

  const load = () => AssistantRegistry.list().then(setAssistants)
  useEffect(() => { load() }, [])

  const active = assistants.find((a) => a.id === value)

  const handleSelect = (id: string) => {
    onChange(id)
    AssistantRegistry.setActive(id)
    setShowList(false)
  }

  const handleCreate = async () => {
    if (!newName.trim() || !newPrompt.trim()) return
    const a = await AssistantRegistry.add({
      name: newName.trim(),
      icon: newIcon || '\u{1F9D1}',
      systemPrompt: newPrompt.trim(),
      description: newDesc.trim() || newName.trim(),
      model: newModel.trim(),
      tools: [],
      parameters: {},
      category: newCategory || t('assistant.categoryGeneral'),
    })
    onChange(a.id)
    AssistantRegistry.setActive(a.id)
    setShowCreate(false)
    setNewName('')
    setNewIcon('\u{1F9D1}')
    setNewPrompt('')
    setNewDesc('')
    setNewModel('')
    setNewCategory('')
    load()
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm(t('assistant.deleteConfirm'))) return
    await AssistantRegistry.remove(id)
    if (value === id) {
      onChange('ast-default')
      AssistantRegistry.setActive('ast-default')
    }
    load()
  }

  const builtinAssistants = assistants.filter((a) => a.isBuiltIn)
  const customAssistants = assistants.filter((a) => !a.isBuiltIn)

  return (
    <div className="persona-selector">
      <button
        className="persona-trigger"
        onClick={() => setShowList(!showList)}
        title={active ? `${active.name}: ${active.description}` : t('assistant.selectTitle')}
      >
        <span>{active?.icon ?? '\u{1F916}'}</span>
        <span className="persona-name">{active?.name ?? t('assistant.defaultName')}</span>
        <span className="persona-arrow">{showList ? '\u25B2' : '\u25BC'}</span>
      </button>

      {showList && (
        <div className="persona-dropdown">
          {builtinAssistants.length > 0 && (
            <>
              <div className="assistant-category-header">{t('assistant.builtIn')}</div>
              {builtinAssistants.map((a) => (
                <div
                  key={a.id}
                  className={`persona-item ${a.id === value ? 'active' : ''}`}
                  onClick={() => handleSelect(a.id)}
                >
                  <span className="persona-item-icon">{a.icon}</span>
                  <div className="persona-item-info">
                    <div className="persona-item-name">
                      {a.name}
                      {a.model && <span className="assistant-model-badge">{modelBadge(a.model)}</span>}
                    </div>
                    <div className="persona-item-desc">{a.description}</div>
                  </div>
                </div>
              ))}
            </>
          )}

          {customAssistants.length > 0 && (
            <>
              <div className="persona-divider" />
              <div className="assistant-category-header">{t('assistant.custom')}</div>
              {customAssistants.map((a) => (
                <div
                  key={a.id}
                  className={`persona-item ${a.id === value ? 'active' : ''}`}
                  onClick={() => handleSelect(a.id)}
                >
                  <span className="persona-item-icon">{a.icon}</span>
                  <div className="persona-item-info">
                    <div className="persona-item-name">
                      {a.name}
                      {a.model && <span className="assistant-model-badge">{modelBadge(a.model)}</span>}
                    </div>
                    <div className="persona-item-desc">
                      {a.description}
                      {a.usageCount > 0 && (
                        <span className="assistant-usage-count">{t('assistant.usageCount', { n: a.usageCount })}</span>
                      )}
                    </div>
                  </div>
                  <button className="icon-btn btn-xs" onClick={(e) => handleDelete(e, a.id)} title={t('common.delete')}>{'\u2715'}</button>
                </div>
              ))}
            </>
          )}

          <div className="persona-divider" />
          <button className="persona-add-btn" onClick={() => { setShowCreate(true); setShowList(false) }}>
            {t('assistant.addBtn')}
          </button>
        </div>
      )}

      {showCreate && (
        <div className="persona-create-overlay" onClick={() => setShowCreate(false)}>
          <div className="persona-create-modal" onClick={(e) => e.stopPropagation()}>
            <div className="persona-create-title">{t('assistant.createTitle')}</div>
            <div className="gap-2">
              <div style={{ display: 'flex', gap: 8 }}>
                <div className="field" style={{ flex: '0 0 60px' }}>
                  <label className="field-label">{t('assistant.iconLabel')}</label>
                  <input className="input" value={newIcon} onChange={(e) => setNewIcon(e.target.value)} maxLength={2} style={{ textAlign: 'center', fontSize: 18 }} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label className="field-label">{t('assistant.nameLabel')}</label>
                  <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('assistant.namePlaceholder')} />
                </div>
              </div>
              <div className="field">
                <label className="field-label">{t('assistant.descLabel')}</label>
                <input className="input" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder={t('assistant.descPlaceholder')} />
              </div>
              <div className="field">
                <label className="field-label">{t('assistant.promptLabel')}</label>
                <textarea className="textarea" rows={5} value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)} placeholder={t('assistant.promptPlaceholder')} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label className="field-label">{t('assistant.modelLabel')}</label>
                  <input className="input" value={newModel} onChange={(e) => setNewModel(e.target.value)} placeholder={t('assistant.modelHint')} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label className="field-label">{t('assistant.categoryLabel')}</label>
                  <input className="input" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder={t('assistant.categoryGeneral')} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>{t('common.cancel')}</button>
                <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={!newName.trim() || !newPrompt.trim()}>{t('common.create')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
