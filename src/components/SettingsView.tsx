import { useState, useEffect } from 'react'
import { useConfig } from '../hooks/useConfig'
import { useProvider } from '../hooks/useProvider'
import { signRequest } from '../lib/aws-sigv4'
import { DEFAULT_SHORTCUTS, loadShortcuts, type Shortcut } from '../lib/shortcuts'
import { UsageView } from './UsageView'
import type { ProviderType } from '../lib/providers/types'
import { useLocale } from '../i18n'

export function SettingsView() {
  const { t } = useLocale()
  const { config, update } = useConfig()
  const { allModels, providers } = useProvider(config)
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState<Record<string, boolean>>({})
  const [testResults, setTestResults] = useState<Record<string, 'success' | 'error' | null>>({})
  const [draft, setDraft] = useState({
    aws: { ...config.aws },
    openai: { ...config.openai },
    gemini: { ...config.gemini },
  })
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(DEFAULT_SHORTCUTS)

  useEffect(() => { loadShortcuts().then(setShortcuts) }, [])

  const handleSave = async () => {
    await update({ aws: draft.aws, openai: draft.openai, gemini: draft.gemini })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleTest = async (providerType: ProviderType) => {
    setTesting((p) => ({ ...p, [providerType]: true }))
    setTestResults((p) => ({ ...p, [providerType]: null }))
    try {
      const provider = providers.find((p) => p.type === providerType)
      if (!provider) { setTestResults((p) => ({ ...p, [providerType]: 'error' })); return }

      // For bedrock, recreate with draft credentials
      if (providerType === 'bedrock') {
        const region = draft.aws.region || 'us-east-1'
        const model = 'us.anthropic.claude-sonnet-4-6'
        const bodyStr = JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }],
        })
        const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(model)}/invoke`
        const signedHeaders = await signRequest({
          method: 'POST', url, headers: { 'content-type': 'application/json' },
          body: bodyStr, accessKeyId: draft.aws.accessKeyId, secretAccessKey: draft.aws.secretAccessKey,
          region, service: 'bedrock',
        })
        const resp = await fetch(url, { method: 'POST', headers: signedHeaders, body: bodyStr })
        setTestResults((p) => ({ ...p, [providerType]: resp.ok ? 'success' : 'error' }))
      } else if (providerType === 'openai') {
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${draft.openai.apiKey}` },
          body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Hi' }], max_tokens: 5 }),
        })
        setTestResults((p) => ({ ...p, [providerType]: resp.ok ? 'success' : 'error' }))
      } else if (providerType === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${draft.gemini.apiKey}`
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Hi' }] }], generationConfig: { maxOutputTokens: 5 } }),
        })
        setTestResults((p) => ({ ...p, [providerType]: resp.ok ? 'success' : 'error' }))
      }
    } catch {
      setTestResults((p) => ({ ...p, [providerType]: 'error' }))
    } finally {
      setTesting((p) => ({ ...p, [providerType]: false }))
    }
  }

  const toggleSecret = (key: string) => setShowSecret((s) => ({ ...s, [key]: !s[key] }))

  const hasBedrockKey = !!draft.aws.accessKeyId && !!draft.aws.secretAccessKey
  const hasOpenaiKey = !!draft.openai.apiKey
  const hasGeminiKey = !!draft.gemini.apiKey

  const bedrockModels = allModels.filter((m) => m.provider === 'bedrock')
  const openaiModels = allModels.filter((m) => m.provider === 'openai')
  const geminiModels = allModels.filter((m) => m.provider === 'gemini')

  const TestBadge = ({ type }: { type: ProviderType }) => (
    <>
      {testResults[type] === 'success' && <span style={{ fontSize: 11, color: 'var(--green, var(--accent))' }}>{t('settings.testSuccess')}</span>}
      {testResults[type] === 'error' && <span style={{ fontSize: 11, color: 'var(--red)' }}>{t('settings.testFail')}</span>}
    </>
  )

  return (
    <div className="settings">
      <div className="settings-section">
        <div className="settings-section-title">{t('settings.providerTitle')}</div>

        {/* AWS Bedrock */}
        <div className="provider-card">
          <div className="provider-header">
            <div className="provider-dot" style={{ background: '#ff9900' }} />
            <span className="provider-label">AWS Bedrock</span>
            <span className={`badge ${hasBedrockKey ? 'badge-green' : 'badge-red'}`}>
              {hasBedrockKey ? t('common.configured') : t('common.notConfigured')}
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text3)' }}>
            {bedrockModels.map((m) => m.shortLabel).join(' · ')}
          </div>

          <div className="field" style={{ marginTop: 8 }}>
            <label className="field-label">Access Key ID</label>
            <input className="input" type="text" placeholder="AKIA..."
              value={draft.aws.accessKeyId}
              onChange={(e) => setDraft({ ...draft, aws: { ...draft.aws, accessKeyId: e.target.value } })} />
          </div>
          <div className="field">
            <label className="field-label">Secret Access Key</label>
            <div className="api-input-row">
              <input className="input" type={showSecret.bedrock ? 'text' : 'password'} placeholder={t('settings.secretAccessKey')}
                value={draft.aws.secretAccessKey}
                onChange={(e) => setDraft({ ...draft, aws: { ...draft.aws, secretAccessKey: e.target.value } })} />
              <button className="btn btn-ghost btn-xs" onClick={() => toggleSecret('bedrock')}>
                {showSecret.bedrock ? t('settings.hide') : t('settings.show')}
              </button>
            </div>
          </div>
          <div className="field">
            <label className="field-label">Region</label>
            <input className="input" type="text" placeholder="us-east-1"
              value={draft.aws.region}
              onChange={(e) => setDraft({ ...draft, aws: { ...draft.aws, region: e.target.value } })} />
            <div className="field-hint">{t('settings.defaultHint')}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-secondary btn-xs" onClick={() => handleTest('bedrock')} disabled={testing.bedrock || !hasBedrockKey}>
              {testing.bedrock ? <><span className="spinner-sm" /> {t('settings.testing')}</> : t('settings.testConnection')}
            </button>
            <TestBadge type="bedrock" />
          </div>
        </div>

        {/* OpenAI */}
        <div className="provider-card">
          <div className="provider-header">
            <div className="provider-dot" style={{ background: '#10a37f' }} />
            <span className="provider-label">OpenAI</span>
            <span className={`badge ${hasOpenaiKey ? 'badge-green' : 'badge-red'}`}>
              {hasOpenaiKey ? t('common.configured') : t('common.notConfigured')}
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text3)' }}>
            {openaiModels.map((m) => m.shortLabel).join(' · ')}
          </div>

          <div className="field" style={{ marginTop: 8 }}>
            <label className="field-label">API Key</label>
            <div className="api-input-row">
              <input className="input" type={showSecret.openai ? 'text' : 'password'} placeholder="sk-..."
                value={draft.openai.apiKey}
                onChange={(e) => setDraft({ ...draft, openai: { ...draft.openai, apiKey: e.target.value } })} />
              <button className="btn btn-ghost btn-xs" onClick={() => toggleSecret('openai')}>
                {showSecret.openai ? t('settings.hide') : t('settings.show')}
              </button>
            </div>
            <div className="field-hint">
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">OpenAI API Keys</a> {t('settings.issuedFrom')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-secondary btn-xs" onClick={() => handleTest('openai')} disabled={testing.openai || !hasOpenaiKey}>
              {testing.openai ? <><span className="spinner-sm" /> {t('settings.testing')}</> : t('settings.testConnection')}
            </button>
            <TestBadge type="openai" />
          </div>
        </div>

        {/* Gemini */}
        <div className="provider-card">
          <div className="provider-header">
            <div className="provider-dot" style={{ background: '#4285f4' }} />
            <span className="provider-label">Google Gemini</span>
            <span className={`badge ${hasGeminiKey ? 'badge-green' : 'badge-red'}`}>
              {hasGeminiKey ? t('common.configured') : t('common.notConfigured')}
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text3)' }}>
            {geminiModels.map((m) => m.shortLabel).join(' · ')}
          </div>

          <div className="field" style={{ marginTop: 8 }}>
            <label className="field-label">API Key</label>
            <div className="api-input-row">
              <input className="input" type={showSecret.gemini ? 'text' : 'password'} placeholder="AIza..."
                value={draft.gemini.apiKey}
                onChange={(e) => setDraft({ ...draft, gemini: { ...draft.gemini, apiKey: e.target.value } })} />
              <button className="btn btn-ghost btn-xs" onClick={() => toggleSecret('gemini')}>
                {showSecret.gemini ? t('settings.hide') : t('settings.show')}
              </button>
            </div>
            <div className="field-hint">
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio</a> {t('settings.issuedFrom')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-secondary btn-xs" onClick={() => handleTest('gemini')} disabled={testing.gemini || !hasGeminiKey}>
              {testing.gemini ? <><span className="spinner-sm" /> {t('settings.testing')}</> : t('settings.testConnection')}
            </button>
            <TestBadge type="gemini" />
          </div>
        </div>

        <button className={`btn ${saved ? 'btn-secondary' : 'btn-primary'} btn-full`} onClick={handleSave}>
          {saved ? t('settings.saved') : t('settings.saveChanges')}
        </button>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">{t('settings.generalTitle')}</div>
        <div className="field">
          <label className="field-label">{t('settings.defaultModel')}</label>
          <select className="select" value={config.defaultModel} onChange={(e) => update({ defaultModel: e.target.value })}>
            {allModels.map((m) => (
              <option key={m.id} value={m.id}>{m.emoji} {m.label}</option>
            ))}
          </select>
        </div>

        <div>
          {[
            { key: 'autoRouting', label: t('settings.toggles.autoRouting'), sub: t('settings.toggles.autoRoutingSub') },
            { key: 'enableContentScript', label: t('settings.toggles.contentScript'), sub: t('settings.toggles.contentScriptSub') },
            { key: 'enableSearchEnhance', label: t('settings.toggles.searchEnhance'), sub: t('settings.toggles.searchEnhanceSub') },
            { key: 'enableWebSearch', label: t('settings.toggles.webSearch'), sub: t('settings.toggles.webSearchSub') },
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

        <div className="field" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <label className="field-label">{t('settings.languageLabel')}</label>
          <select className="select" value={config.language} onChange={(e) => update({ language: e.target.value })}>
            <option value="ko">한국어</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      {config.enableWebSearch && (
        <div className="settings-section">
          <div className="settings-section-title">{t('settings.searchTitle')}</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>
            {t('settings.search.desc')}
          </div>
          <div className="field">
            <label className="field-label">{t('settings.search.googleApiKey')}</label>
            <input className="input" type="text" placeholder="AIza..."
              value={config.googleSearchApiKey}
              onChange={(e) => update({ googleSearchApiKey: e.target.value })} />
          </div>
          <div className="field">
            <label className="field-label">{t('settings.search.googleCseId')}</label>
            <input className="input" type="text" placeholder="1234567890:abcdefg"
              value={config.googleSearchEngineId}
              onChange={(e) => update({ googleSearchEngineId: e.target.value })} />
            <div className="field-hint">
              <a href="https://programmablesearchengine.google.com/" target="_blank" rel="noreferrer">Google Programmable Search Engine</a> {t('settings.createdFrom')}
            </div>
          </div>
        </div>
      )}

      <div className="settings-section">
        <div className="settings-section-title">{t('settings.shortcutsTitle')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {shortcuts.map((s) => (
            <div key={s.id} className="shortcut-row">
              <span className="shortcut-desc">{t(s.description)}</span>
              <kbd>{s.keys.replace('Ctrl', navigator.platform.includes('Mac') ? '⌘' : 'Ctrl')}</kbd>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
          {t('settings.globalShortcuts')}
        </div>
      </div>

      <div className="settings-section">
        <UsageView />
      </div>

      <div className="settings-section">
        <div className="settings-section-title">{t('settings.infoTitle')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--bg2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg, var(--accent), var(--accent2))', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 18, color: '#061210' }}>H</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>H Chat v3.0</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>Claude · GPT · Gemini · Multi-Provider</div>
          </div>
        </div>
      </div>
    </div>
  )
}
