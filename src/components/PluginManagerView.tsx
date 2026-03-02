import { useState, useEffect, useCallback } from 'react'
import { PluginRegistry, type Plugin, type PluginType, type WebhookConfig, type PromptConfig, type JavaScriptConfig } from '../lib/pluginRegistry'
import { BUILTIN_TOOLS } from '../lib/agentTools'
import { useLocale } from '../i18n'

type FormMode = 'list' | 'add' | 'edit'

interface PluginForm {
  name: string
  description: string
  type: PluginType
  enabled: boolean
  webhookUrl: string
  webhookMethod: 'GET' | 'POST'
  webhookHeaders: string
  template: string
  code: string
}

const EMPTY_FORM: PluginForm = {
  name: '',
  description: '',
  type: 'prompt',
  enabled: true,
  webhookUrl: '',
  webhookMethod: 'POST',
  webhookHeaders: '',
  template: '{{input}}',
  code: 'return input.toUpperCase()',
}

function formToPlugin(form: PluginForm): Omit<Plugin, 'id'> {
  let config: WebhookConfig | PromptConfig | JavaScriptConfig

  if (form.type === 'webhook') {
    let headers: Record<string, string> | undefined
    try {
      headers = form.webhookHeaders.trim() ? JSON.parse(form.webhookHeaders) : undefined
    } catch {
      headers = undefined
    }
    config = { url: form.webhookUrl, method: form.webhookMethod, headers }
  } else if (form.type === 'javascript') {
    config = { code: form.code }
  } else {
    config = { template: form.template }
  }

  return {
    name: form.name,
    description: form.description,
    type: form.type,
    enabled: form.enabled,
    config,
  }
}

function pluginToForm(plugin: Plugin): PluginForm {
  const base = {
    name: plugin.name,
    description: plugin.description,
    type: plugin.type,
    enabled: plugin.enabled,
    webhookUrl: '',
    webhookMethod: 'POST' as const,
    webhookHeaders: '',
    template: '{{input}}',
    code: 'return input.toUpperCase()',
  }

  if (plugin.type === 'webhook') {
    const cfg = plugin.config as WebhookConfig
    return { ...base, webhookUrl: cfg.url, webhookMethod: cfg.method, webhookHeaders: cfg.headers ? JSON.stringify(cfg.headers, null, 2) : '' }
  }
  if (plugin.type === 'javascript') {
    const cfg = plugin.config as JavaScriptConfig
    return { ...base, code: cfg.code }
  }
  const cfg = plugin.config as PromptConfig
  return { ...base, template: cfg.template }
}

export default function PluginManagerView() {
  const { t } = useLocale()
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [mode, setMode] = useState<FormMode>('list')
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<PluginForm>(EMPTY_FORM)

  const reload = useCallback(async () => {
    const list = await PluginRegistry.list()
    setPlugins(list)
  }, [])

  useEffect(() => { reload() }, [reload])

  const handleAdd = async () => {
    if (!form.name.trim()) return
    await PluginRegistry.add(formToPlugin(form))
    setForm(EMPTY_FORM)
    setMode('list')
    await reload()
  }

  const handleUpdate = async () => {
    if (!editId || !form.name.trim()) return
    await PluginRegistry.update(editId, formToPlugin(form))
    setForm(EMPTY_FORM)
    setEditId(null)
    setMode('list')
    await reload()
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('plugins.deleteConfirm'))) return
    await PluginRegistry.remove(id)
    await reload()
  }

  const handleToggle = async (id: string, enabled: boolean) => {
    await PluginRegistry.update(id, { enabled })
    await reload()
  }

  const startEdit = (plugin: Plugin) => {
    setEditId(plugin.id)
    setForm(pluginToForm(plugin))
    setMode('edit')
  }

  const updateForm = (partial: Partial<PluginForm>) => {
    setForm((prev) => ({ ...prev, ...partial }))
  }

  if (mode === 'add' || mode === 'edit') {
    return (
      <div className="plugin-manager">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <button className="btn btn-ghost btn-xs" onClick={() => { setMode('list'); setEditId(null); setForm(EMPTY_FORM) }}>
            {t('common.back')}
          </button>
          <span style={{ fontWeight: 600, fontSize: 13 }}>
            {mode === 'add' ? t('plugins.add') : t('common.edit')}
          </span>
        </div>

        <div className="field">
          <label className="field-label">{t('plugins.name')}</label>
          <input className="input" value={form.name} onChange={(e) => updateForm({ name: e.target.value })} placeholder="My Plugin" />
        </div>

        <div className="field">
          <label className="field-label">{t('plugins.description')}</label>
          <input className="input" value={form.description} onChange={(e) => updateForm({ description: e.target.value })} placeholder="What this plugin does..." />
        </div>

        <div className="field">
          <label className="field-label">{t('plugins.type')}</label>
          <select className="select" value={form.type} onChange={(e) => updateForm({ type: e.target.value as PluginType })}>
            <option value="prompt">{t('plugins.prompt')}</option>
            <option value="webhook">{t('plugins.webhook')}</option>
            <option value="javascript">{t('plugins.javascript')}</option>
          </select>
        </div>

        {form.type === 'webhook' && (
          <>
            <div className="field">
              <label className="field-label">{t('plugins.url')}</label>
              <input className="input" type="url" value={form.webhookUrl} onChange={(e) => updateForm({ webhookUrl: e.target.value })} placeholder="https://api.example.com/action" />
            </div>
            <div className="field">
              <label className="field-label">{t('plugins.method')}</label>
              <select className="select" value={form.webhookMethod} onChange={(e) => updateForm({ webhookMethod: e.target.value as 'GET' | 'POST' })}>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
            </div>
            <div className="field">
              <label className="field-label">{t('plugins.headers')}</label>
              <textarea className="input" rows={3} value={form.webhookHeaders} onChange={(e) => updateForm({ webhookHeaders: e.target.value })} placeholder='{"Authorization": "Bearer ..."}' style={{ fontFamily: 'var(--mono)', fontSize: 11 }} />
            </div>
          </>
        )}

        {form.type === 'prompt' && (
          <div className="field">
            <label className="field-label">{t('plugins.template')}</label>
            <textarea className="input" rows={4} value={form.template} onChange={(e) => updateForm({ template: e.target.value })} placeholder="Translate the following text: {{input}}" style={{ fontFamily: 'var(--mono)', fontSize: 11 }} />
            <div className="field-hint">{t('plugins.templateHint')}</div>
          </div>
        )}

        {form.type === 'javascript' && (
          <div className="field">
            <label className="field-label">{t('plugins.code')}</label>
            <textarea className="input" rows={4} value={form.code} onChange={(e) => updateForm({ code: e.target.value })} placeholder="return input.toUpperCase()" style={{ fontFamily: 'var(--mono)', fontSize: 11 }} />
            <div className="field-hint">{t('plugins.codeHint')}</div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <input type="checkbox" id="plugin-enabled" checked={form.enabled} onChange={(e) => updateForm({ enabled: e.target.checked })} />
          <label htmlFor="plugin-enabled" style={{ fontSize: 12, cursor: 'pointer' }}>{t('plugins.enabled')}</label>
        </div>

        <button
          className="btn btn-primary btn-full"
          style={{ marginTop: 12 }}
          onClick={mode === 'add' ? handleAdd : handleUpdate}
          disabled={!form.name.trim()}
        >
          {t('common.save')}
        </button>
      </div>
    )
  }

  return (
    <div className="plugin-manager">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{t('plugins.title')}</span>
        <button className="btn btn-primary btn-xs" onClick={() => { setForm(EMPTY_FORM); setMode('add') }}>
          {t('plugins.add')}
        </button>
      </div>

      {/* Built-in tools */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 4 }}>{t('plugins.builtIn')}</div>
        {BUILTIN_TOOLS.map((tool) => (
          <div key={tool.name} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px 8px', borderBottom: '1px solid var(--border)',
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, fontFamily: 'var(--mono)' }}>{tool.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>{tool.description}</div>
            </div>
            <span style={{ fontSize: 10, color: 'var(--text3)', whiteSpace: 'nowrap' }}>built-in</span>
          </div>
        ))}
      </div>

      {/* Custom plugins */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 4 }}>{t('plugins.custom')}</div>
        {plugins.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)', padding: '12px 0', textAlign: 'center' }}>
            {t('plugins.noPlugins')}
          </div>
        ) : (
          plugins.map((plugin) => (
            <div key={plugin.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 8px', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{plugin.name}</span>
                  <span style={{
                    fontSize: 9, padding: '1px 4px', borderRadius: 3,
                    background: 'var(--bg3)', color: 'var(--text2)',
                  }}>
                    {plugin.type}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {plugin.description}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <button
                  className={`toggle toggle-sm ${plugin.enabled ? 'on' : ''}`}
                  onClick={() => handleToggle(plugin.id, !plugin.enabled)}
                  title={t('plugins.enabled')}
                >
                  <span className="toggle-knob" />
                </button>
                <button className="btn btn-ghost btn-xs" onClick={() => startEdit(plugin)} title={t('common.edit')}>
                  {t('common.edit')}
                </button>
                <button className="btn btn-ghost btn-xs" onClick={() => handleDelete(plugin.id)} title={t('common.delete')} style={{ color: 'var(--red)' }}>
                  {t('common.delete')}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
