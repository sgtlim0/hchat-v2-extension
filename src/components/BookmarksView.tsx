import { useState, useEffect, useCallback } from 'react'
import { Bookmarks, timeAgo, type Highlight, type HighlightColor } from '../lib/bookmarks'

const COLOR_MAP: Record<HighlightColor, string> = {
  yellow: '#fbbf24',
  green: '#34d399',
  blue: '#60a5fa',
  pink: '#f472b6',
  purple: '#a78bfa',
}

export function BookmarksView() {
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [allTags, setAllTags] = useState<string[]>([])
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')

  const load = useCallback(async () => {
    const items = await Bookmarks.list({
      query: searchQuery || undefined,
      tag: selectedTag ?? undefined,
    })
    setHighlights(items)
    const tags = await Bookmarks.getAllTags()
    setAllTags(tags)
  }, [searchQuery, selectedTag])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    await Bookmarks.delete(id)
    load()
  }

  const handleColorChange = async (id: string, color: HighlightColor) => {
    await Bookmarks.update(id, { color })
    load()
  }

  const handleSaveNote = async (id: string) => {
    await Bookmarks.update(id, { note: noteText })
    setEditingNote(null)
    setNoteText('')
    load()
  }

  const handleGoToPage = (url: string) => {
    chrome.tabs.create({ url })
  }

  return (
    <div className="bookmarks-view">
      <div className="bookmarks-header">
        <div className="panel-header">
          <span className="panel-title">하이라이트</span>
          <span className="panel-meta">{highlights.length}개</span>
        </div>
        <input
          className="input"
          placeholder="하이라이트 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ marginTop: 8 }}
        />
        {allTags.length > 0 && (
          <div className="tag-chips">
            <button
              className={`tag-chip ${selectedTag === null ? 'active' : ''}`}
              onClick={() => setSelectedTag(null)}
            >
              전체
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                className={`tag-chip ${selectedTag === tag ? 'active' : ''}`}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="highlight-list">
        {highlights.length === 0 ? (
          <div className="empty-state">
            <span className="e-icon">🖍️</span>
            <h3>하이라이트가 없습니다</h3>
            <p>웹페이지에서 텍스트를 선택하고 하이라이트 버튼을 클릭하세요</p>
          </div>
        ) : (
          highlights.map((h) => (
            <div key={h.id} className="highlight-card">
              <div className="highlight-color-bar" style={{ background: COLOR_MAP[h.color] }} />
              <div className="highlight-content">
                <blockquote className="highlight-text">{h.text}</blockquote>
                {h.aiSummary && (
                  <div className="highlight-ai-note">AI: {h.aiSummary}</div>
                )}
                {editingNote === h.id ? (
                  <div className="highlight-note-edit">
                    <textarea
                      className="textarea"
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="메모 입력..."
                      rows={2}
                      style={{ minHeight: 40 }}
                    />
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-primary btn-xs" onClick={() => handleSaveNote(h.id)}>저장</button>
                      <button className="btn btn-ghost btn-xs" onClick={() => setEditingNote(null)}>취소</button>
                    </div>
                  </div>
                ) : (
                  h.note && <div className="highlight-user-note">📝 {h.note}</div>
                )}
                {h.tags.length > 0 && (
                  <div className="highlight-tags">
                    {h.tags.map((t) => (
                      <span key={t} className="badge badge-blue">#{t}</span>
                    ))}
                  </div>
                )}
                <div className="highlight-meta">
                  <a
                    className="highlight-page-link"
                    onClick={() => handleGoToPage(h.url)}
                    title={h.url}
                  >
                    {h.title.slice(0, 40) || new URL(h.url).hostname}
                  </a>
                  <span className="text-xs text-mono">{timeAgo(h.createdAt)}</span>
                </div>
                <div className="highlight-actions">
                  <button
                    className="icon-btn btn-xs"
                    title="메모"
                    onClick={() => { setEditingNote(h.id); setNoteText(h.note ?? '') }}
                  >📝</button>
                  <div className="color-picker">
                    {(Object.keys(COLOR_MAP) as HighlightColor[]).map((c) => (
                      <button
                        key={c}
                        className={`color-dot ${h.color === c ? 'active' : ''}`}
                        style={{ background: COLOR_MAP[c] }}
                        onClick={() => handleColorChange(h.id, c)}
                      />
                    ))}
                  </div>
                  <button className="icon-btn btn-xs btn-danger" title="삭제" onClick={() => handleDelete(h.id)}>🗑️</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
