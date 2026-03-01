import { useState, useEffect } from 'react'
import { Personas, type Persona } from '../lib/personas'

interface Props {
  value: string
  onChange: (personaId: string) => void
}

export function PersonaSelector({ value, onChange }: Props) {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [showList, setShowList] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('🧑')
  const [newPrompt, setNewPrompt] = useState('')
  const [newDesc, setNewDesc] = useState('')

  const load = () => Personas.list().then(setPersonas)
  useEffect(() => { load() }, [])

  const active = personas.find((p) => p.id === value)

  const handleSelect = (id: string) => {
    onChange(id)
    Personas.setActive(id)
    setShowList(false)
  }

  const handleCreate = async () => {
    if (!newName.trim() || !newPrompt.trim()) return
    const p = await Personas.add({
      name: newName.trim(),
      icon: newIcon || '🧑',
      systemPrompt: newPrompt.trim(),
      description: newDesc.trim() || newName.trim(),
    })
    onChange(p.id)
    Personas.setActive(p.id)
    setShowCreate(false)
    setNewName('')
    setNewIcon('🧑')
    setNewPrompt('')
    setNewDesc('')
    load()
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await Personas.remove(id)
    if (value === id) {
      onChange('default')
      Personas.setActive('default')
    }
    load()
  }

  return (
    <div className="persona-selector">
      <button
        className="persona-trigger"
        onClick={() => setShowList(!showList)}
        title={active ? `${active.name}: ${active.description}` : '페르소나 선택'}
      >
        <span>{active?.icon ?? '🤖'}</span>
        <span className="persona-name">{active?.name ?? '기본'}</span>
        <span className="persona-arrow">{showList ? '▲' : '▼'}</span>
      </button>

      {showList && (
        <div className="persona-dropdown">
          {personas.map((p) => (
            <div
              key={p.id}
              className={`persona-item ${p.id === value ? 'active' : ''}`}
              onClick={() => handleSelect(p.id)}
            >
              <span className="persona-item-icon">{p.icon}</span>
              <div className="persona-item-info">
                <div className="persona-item-name">{p.name}</div>
                <div className="persona-item-desc">{p.description}</div>
              </div>
              {!p.builtin && (
                <button className="icon-btn btn-xs" onClick={(e) => handleDelete(e, p.id)} title="삭제">✕</button>
              )}
            </div>
          ))}
          <div className="persona-divider" />
          <button className="persona-add-btn" onClick={() => { setShowCreate(true); setShowList(false) }}>
            + 새 페르소나 만들기
          </button>
        </div>
      )}

      {showCreate && (
        <div className="persona-create-overlay" onClick={() => setShowCreate(false)}>
          <div className="persona-create-modal" onClick={(e) => e.stopPropagation()}>
            <div className="persona-create-title">새 페르소나 만들기</div>
            <div className="gap-2">
              <div style={{ display: 'flex', gap: 8 }}>
                <div className="field" style={{ flex: '0 0 60px' }}>
                  <label className="field-label">아이콘</label>
                  <input className="input" value={newIcon} onChange={(e) => setNewIcon(e.target.value)} maxLength={2} style={{ textAlign: 'center', fontSize: 18 }} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label className="field-label">이름</label>
                  <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="예: 마케팅 전문가" />
                </div>
              </div>
              <div className="field">
                <label className="field-label">설명 (선택)</label>
                <input className="input" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="짧은 설명..." />
              </div>
              <div className="field">
                <label className="field-label">시스템 프롬프트</label>
                <textarea className="textarea" rows={5} value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)} placeholder="AI의 역할, 성격, 답변 스타일을 정의하세요..." />
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>취소</button>
                <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={!newName.trim() || !newPrompt.trim()}>만들기</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
