import { useState, useEffect } from 'react'
import { PromptLibrary, type Prompt } from '../lib/promptLibrary'

interface Props {
  onUsePrompt?: (content: string) => void
}

const CATEGORIES = ['전체', '읽기', '번역', '글쓰기', '코드', '분석', '설명']

export function PromptLibraryView({ onUsePrompt }: Props) {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [category, setCategory] = useState('전체')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', shortcut: '', category: '글쓰기' })
  const [editing, setEditing] = useState<string | null>(null)

  const load = () => PromptLibrary.list().then(setPrompts)
  useEffect(() => { load() }, [])

  const filtered = prompts.filter((p) => {
    const matchCat = category === '전체' || p.category === category
    const q = search.toLowerCase()
    const matchSearch = !q || p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q) || p.shortcut?.includes(q)
    return matchCat && matchSearch
  })

  const handleSave = async () => {
    if (!form.title || !form.content) return
    if (editing) {
      await PromptLibrary.update(editing, form)
    } else {
      await PromptLibrary.save(form)
    }
    setAdding(false)
    setEditing(null)
    setForm({ title: '', content: '', shortcut: '', category: '글쓰기' })
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return
    await PromptLibrary.delete(id)
    load()
  }

  const startEdit = (p: Prompt) => {
    setForm({ title: p.title, content: p.content, shortcut: p.shortcut ?? '', category: p.category })
    setEditing(p.id)
    setAdding(true)
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">📚 프롬프트 라이브러리</span>
        <button className="btn btn-primary btn-xs" onClick={() => { setAdding(!adding); setEditing(null); setForm({ title: '', content: '', shortcut: '', category: '글쓰기' }) }}>
          {adding ? '취소' : '+ 추가'}
        </button>
      </div>

      {/* Add / Edit form */}
      {adding && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="field">
            <label className="field-label">제목</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="프롬프트 이름" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="field">
              <label className="field-label">단축키 (/ 다음에)</label>
              <input className="input" value={form.shortcut} onChange={(e) => setForm({ ...form, shortcut: e.target.value })} placeholder="sum, tr, ..." />
            </div>
            <div className="field">
              <label className="field-label">카테고리</label>
              <select className="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.filter((c) => c !== '전체').map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label className="field-label">내용 ({"{{content}}"} = 선택 텍스트)</label>
            <textarea className="textarea" rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder={'다음 내용을 요약해줘:\n\n{{content}}'} />
          </div>
          <button className="btn btn-primary" onClick={handleSave}>{editing ? '수정 저장' : '추가'}</button>
        </div>
      )}

      {/* Search */}
      <input className="input" placeholder="🔍 프롬프트 검색..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {/* Category filter */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCategory(c)}
            style={{
              padding: '3px 10px', borderRadius: 999, border: '1px solid',
              borderColor: category === c ? 'var(--accent)' : 'var(--border2)',
              background: category === c ? 'var(--accent-dim)' : 'transparent',
              color: category === c ? 'var(--accent)' : 'var(--text2)',
              fontSize: 11, cursor: 'pointer',
            }}>
            {c}
          </button>
        ))}
      </div>

      {/* Prompt list */}
      <div className="prompt-list">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <span className="e-icon">📝</span>
            <h3>프롬프트가 없습니다</h3>
            <p>+ 추가 버튼으로 나만의 프롬프트를 만드세요</p>
          </div>
        ) : (
          filtered.map((p) => (
            <div key={p.id} className="prompt-card" onClick={() => onUsePrompt?.(p.content)}>
              <div className="pc-main">
                <div className="pc-title">{p.title}</div>
                <div className="pc-preview">{p.content}</div>
                <div className="pc-meta">
                  {p.shortcut && <span className="pc-shortcut">/{p.shortcut}</span>}
                  <span className="pc-cat">{p.category}</span>
                  {p.usageCount > 0 && <span className="pc-cat">· {p.usageCount}회 사용</span>}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button className="btn btn-ghost btn-xs" onClick={(e) => { e.stopPropagation(); startEdit(p) }}>편집</button>
                <button className="btn btn-ghost btn-xs btn-danger" onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }}>삭제</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
