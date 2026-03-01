import { useState, useEffect } from 'react'
import { useConfig } from '../hooks/useConfig'
import { MODELS } from '../lib/models'
import { signRequest } from '../lib/aws-sigv4'
import { DEFAULT_SHORTCUTS, loadShortcuts, type Shortcut } from '../lib/shortcuts'
import { UsageView } from './UsageView'

export function SettingsView() {
  const { config, update } = useConfig()
  const [showSecret, setShowSecret] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [draft, setDraft] = useState({ ...config.aws })
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(DEFAULT_SHORTCUTS)

  useEffect(() => { loadShortcuts().then(setShortcuts) }, [])

  const handleSave = async () => {
    await update({ aws: draft })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleTest = async () => {
    if (!draft.accessKeyId || !draft.secretAccessKey) return
    setTesting(true)
    setTestResult(null)
    try {
      const region = draft.region || 'us-east-1'
      const model = config.defaultModel || MODELS[0].id
      const bodyStr = JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      })
      const encodedModel = encodeURIComponent(model)
      const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodedModel}/invoke`

      const signedHeaders = await signRequest({
        method: 'POST',
        url,
        headers: { 'content-type': 'application/json' },
        body: bodyStr,
        accessKeyId: draft.accessKeyId,
        secretAccessKey: draft.secretAccessKey,
        region,
        service: 'bedrock',
      })

      const resp = await fetch(url, {
        method: 'POST',
        headers: signedHeaders,
        body: bodyStr,
      })
      setTestResult(resp.ok ? 'success' : 'error')
    } catch {
      setTestResult('error')
    } finally {
      setTesting(false)
    }
  }

  const hasCredentials = !!draft.accessKeyId && !!draft.secretAccessKey

  return (
    <div className="settings">
      <div className="settings-section">
        <div className="settings-section-title">🔑 AWS Bedrock 설정</div>
        <div className="provider-card">
          <div className="provider-header">
            <div className="provider-dot" style={{ background: '#ff9900' }} />
            <span className="provider-label">AWS Bedrock</span>
            <span className={`badge ${hasCredentials ? 'badge-green' : 'badge-red'}`}>
              {hasCredentials ? '✓ 설정됨' : '미설정'}
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text3)' }}>
            {MODELS.map((m) => m.shortLabel).join(' · ')}
          </div>

          <div className="field" style={{ marginTop: 8 }}>
            <label className="field-label">Access Key ID</label>
            <input
              className="input"
              type="text"
              placeholder="AKIA..."
              value={draft.accessKeyId}
              onChange={(e) => setDraft({ ...draft, accessKeyId: e.target.value })}
            />
          </div>

          <div className="field">
            <label className="field-label">Secret Access Key</label>
            <div className="api-input-row">
              <input
                className="input"
                type={showSecret ? 'text' : 'password'}
                placeholder="비밀 액세스 키..."
                value={draft.secretAccessKey}
                onChange={(e) => setDraft({ ...draft, secretAccessKey: e.target.value })}
              />
              <button className="btn btn-ghost btn-xs" onClick={() => setShowSecret(!showSecret)}>
                {showSecret ? '숨김' : '표시'}
              </button>
            </div>
          </div>

          <div className="field">
            <label className="field-label">Region</label>
            <input
              className="input"
              type="text"
              placeholder="us-east-1"
              value={draft.region}
              onChange={(e) => setDraft({ ...draft, region: e.target.value })}
            />
            <div className="field-hint">기본값: us-east-1</div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary btn-xs"
              onClick={handleTest}
              disabled={testing || !hasCredentials}
            >
              {testing ? <><span className="spinner-sm" /> 테스트 중...</> : '연결 테스트'}
            </button>
            {testResult === 'success' && (
              <span style={{ fontSize: 11, color: 'var(--green)', alignSelf: 'center' }}>✓ 연결 성공</span>
            )}
            {testResult === 'error' && (
              <span style={{ fontSize: 11, color: 'var(--red)', alignSelf: 'center' }}>✗ 연결 실패 — 키를 확인해주세요</span>
            )}
          </div>
        </div>

        <button className={`btn ${saved ? 'btn-secondary' : 'btn-primary'} btn-full`} onClick={handleSave}>
          {saved ? '✓ 저장됨' : '변경사항 저장'}
        </button>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">⚙️ 기본 설정</div>
        <div className="field">
          <label className="field-label">기본 모델</label>
          <select
            className="select"
            value={config.defaultModel}
            onChange={(e) => update({ defaultModel: e.target.value })}
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.emoji} {m.label}</option>
            ))}
          </select>
        </div>

        <div>
          {[
            { key: 'enableContentScript', label: '텍스트 선택 도구', sub: '웹페이지에서 텍스트 선택 시 AI 도구 표시' },
            { key: 'enableSearchEnhance', label: '검색 엔진 강화', sub: 'Google/Bing에서 AI 답변 표시' },
            { key: 'enableWebSearch', label: '웹 검색 (RAG)', sub: '질문에 자동으로 웹 검색 결과를 참조하여 답변' },
          ].map(({ key, label, sub }) => (
            <div key={key} className="toggle-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div className="toggle-label">{label}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{sub}</div>
              </div>
              <button
                className={`toggle ${config[key as keyof typeof config] ? 'on' : ''}`}
                onClick={() => update({ [key]: !config[key as keyof typeof config] })}
              >
                <span className="toggle-knob" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {config.enableWebSearch && (
        <div className="settings-section">
          <div className="settings-section-title">🔍 웹 검색 설정</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>
            기본: DuckDuckGo (무료, API 키 불필요). Google Custom Search를 사용하려면 아래에 키를 입력하세요.
          </div>
          <div className="field">
            <label className="field-label">Google Search API Key (선택)</label>
            <input
              className="input"
              type="text"
              placeholder="AIza..."
              value={config.googleSearchApiKey}
              onChange={(e) => update({ googleSearchApiKey: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="field-label">Google CSE Engine ID (선택)</label>
            <input
              className="input"
              type="text"
              placeholder="1234567890:abcdefg"
              value={config.googleSearchEngineId}
              onChange={(e) => update({ googleSearchEngineId: e.target.value })}
            />
            <div className="field-hint">
              <a href="https://programmablesearchengine.google.com/" target="_blank" rel="noreferrer">Google Programmable Search Engine</a>에서 생성
            </div>
          </div>
        </div>
      )}

      <div className="settings-section">
        <div className="settings-section-title">⌨️ 키보드 단축키</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {shortcuts.map((s) => (
            <div key={s.id} className="shortcut-row">
              <span className="shortcut-desc">{s.description}</span>
              <kbd>{s.keys.replace('Ctrl', navigator.platform.includes('Mac') ? '⌘' : 'Ctrl')}</kbd>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
          전역 단축키: Ctrl+Shift+H (사이드패널), Ctrl+Shift+S (빠른 요약)
        </div>
      </div>

      <div className="settings-section">
        <UsageView />
      </div>

      <div className="settings-section">
        <div className="settings-section-title">ℹ️ 정보</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--bg2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg, var(--accent), var(--accent2))', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 18, color: '#061210' }}>H</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>H Chat v2.0</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>AWS Bedrock · Claude Sonnet · Opus · Haiku</div>
          </div>
        </div>
      </div>
    </div>
  )
}
