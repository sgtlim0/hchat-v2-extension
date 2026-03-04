import { useState, useRef, useEffect } from 'react'
import { useProvider } from '../hooks/useProvider'
import { useLocale } from '../i18n'
import { runDebate, type DebateRound, type DebateParticipant } from '../lib/debate'
import { AssistantRegistry, type CustomAssistant } from '../lib/assistantBuilder'
import type { Config } from '../hooks/useConfig'
import type { ProviderType } from '../lib/providers/types'
import { PROVIDER_COLORS } from '../lib/providers/types'

interface Props { config: Config }

export default function DebateView({ config }: Props) {
  const { t } = useLocale()
  const { configuredModels, getProvider, getModel } = useProvider(config)
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [modelAssistants, setModelAssistants] = useState<Record<string, string>>({})
  const [availableAssistants, setAvailableAssistants] = useState<CustomAssistant[]>([])
  const [topic, setTopic] = useState('')
  const [rounds, setRounds] = useState<DebateRound[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [currentChunks, setCurrentChunks] = useState<Record<string, string>>({})
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    AssistantRegistry.list().then(setAvailableAssistants).catch(() => {})
  }, [])

  const toggleModel = (id: string) => {
    setSelectedModels((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : prev.length < 3 ? [...prev, id] : prev
    )
  }

  const handleStart = async () => {
    if (!topic.trim() || selectedModels.length < 2 || isRunning) return
    setRounds([])
    setCurrentChunks({})
    setIsRunning(true)
    abortRef.current = new AbortController()

    const participants: DebateParticipant[] = selectedModels.map((modelId) => ({
      modelId,
      assistantId: modelAssistants[modelId] || undefined,
    }))

    try {
      await runDebate({
        topic: topic.trim(),
        modelIds: selectedModels,
        participants,
        providers: [],
        getProviderForModel: (id) => getProvider(id),
        onRound: (round) => {
          setRounds((prev) => [...prev, round])
          setCurrentChunks((prev) => ({ ...prev, [round.modelId]: '' }))
        },
        onChunk: (modelId, chunk) => {
          setCurrentChunks((prev) => ({ ...prev, [modelId]: (prev[modelId] ?? '') + chunk }))
        },
        signal: abortRef.current.signal,
      })
    } catch (err) {
      if (String(err).includes('Abort')) return
    } finally {
      setIsRunning(false)
    }
  }

  const handleStop = () => {
    abortRef.current?.abort()
    setIsRunning(false)
  }

  return (
    <div className="debate-view">
      {/* Model selection */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 6 }}>
          {t('debate.modelSelect')}
        </div>
        <div className="debate-model-select">
          {configuredModels.map((m) => {
            const selected = selectedModels.includes(m.id)
            const color = PROVIDER_COLORS[m.provider]
            const assistant = modelAssistants[m.id] ? availableAssistants.find((a) => a.id === modelAssistants[m.id]) : undefined
            return (
              <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button
                  className={`model-toggle ${selected ? 'on' : ''}`}
                  onClick={() => toggleModel(m.id)}
                  disabled={isRunning}
                  style={{
                    borderColor: selected ? color : undefined,
                    opacity: isRunning ? 0.5 : 1,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
                  <span>{m.shortLabel}</span>
                  {assistant && <span style={{ fontSize: 9, opacity: 0.7 }}>{assistant.icon}</span>}
                </button>
                {selected && (
                  <select
                    value={modelAssistants[m.id] ?? ''}
                    onChange={(e) => setModelAssistants((prev) => ({ ...prev, [m.id]: e.target.value }))}
                    disabled={isRunning}
                    style={{
                      fontSize: 10,
                      padding: '2px 4px',
                      borderRadius: 4,
                      border: '1px solid var(--border2)',
                      background: 'var(--bg1)',
                      color: 'var(--text2)',
                    }}
                  >
                    <option value="">{t('debate.noAssistant')}</option>
                    {availableAssistants.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.icon} {a.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )
          })}
        </div>
        {configuredModels.length < 2 && (
          <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>
            {t('debate.needModels')}
          </div>
        )}
      </div>

      {/* Topic input */}
      <div className="field">
        <label className="field-label">{t('debate.topicLabel')}</label>
        <textarea
          className="textarea"
          rows={3}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={t('debate.topicPlaceholder')}
          disabled={isRunning}
        />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-primary"
          onClick={handleStart}
          disabled={isRunning || selectedModels.length < 2 || !topic.trim()}
        >
          {isRunning ? <><span className="spinner" /> {t('debate.running')}</> : t('debate.startAction')}
        </button>
        {isRunning && (
          <button className="btn btn-secondary" onClick={handleStop}>{t('common.stop')}</button>
        )}
      </div>

      {/* Debate rounds */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rounds.map((r, i) => {
          const model = getModel(r.modelId)
          const color = model ? PROVIDER_COLORS[model.provider] : 'var(--text3)'
          return (
            <div key={i} className="debate-round">
              <div className="debate-round-header">
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                <span>{model?.shortLabel ?? r.modelId}</span>
                <span style={{ color: 'var(--text3)', fontSize: 10 }}>· {t(`debate.roles.${r.role}`)}</span>
                <span style={{ color: 'var(--text3)', fontSize: 10 }}>· {t('debate.round', { n: r.round })}</span>
                {r.ms > 0 && <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text3)' }}>{(r.ms / 1000).toFixed(1)}s</span>}
              </div>
              <div className="debate-round-content">{r.content}</div>
            </div>
          )
        })}

        {/* Show streaming chunks for current round */}
        {isRunning && Object.entries(currentChunks).some(([, v]) => v.length > 0) && (
          <div className="debate-round" style={{ borderColor: 'var(--accent-dim)' }}>
            <div className="debate-round-header">
              <span className="spinner-sm" />
              <span style={{ color: 'var(--text2)', fontSize: 11 }}>{t('debate.streaming')}</span>
            </div>
            <div className="debate-round-content" style={{ color: 'var(--text2)' }}>
              {Object.entries(currentChunks)
                .filter(([, v]) => v.length > 0)
                .map(([modelId, text]) => {
                  const model = getModel(modelId)
                  return (
                    <div key={modelId} style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>{model?.shortLabel ?? modelId}: </span>
                      {text}<span className="cursor">▌</span>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {rounds.length === 0 && !isRunning && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 12 }}>
            {t('debate.emptyMessage')}
          </div>
        )}
      </div>
    </div>
  )
}
