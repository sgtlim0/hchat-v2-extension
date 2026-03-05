import { useState, useRef, useEffect } from 'react'
import { useProvider } from '../hooks/useProvider'
import { useLocale } from '../i18n'
import { runDebateWithVoting, type DebateRound, type DebateParticipant } from '../lib/debate'
import { getDefaultVotingConfig, type DebateScoreboard } from '../lib/debateVoting'
import { AssistantRegistry, type CustomAssistant } from '../lib/assistantBuilder'
import type { Config } from '../hooks/useConfig'
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
  const [votingEnabled, setVotingEnabled] = useState(true)
  const [scoreboard, setScoreboard] = useState<DebateScoreboard | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    AssistantRegistry.list().then(setAvailableAssistants).catch(() => {})
  }, [])

  const toggleModel = (id: string) => {
    setSelectedModels((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : prev.length < 6 ? [...prev, id] : prev
    )
  }

  const handleStart = async () => {
    if (!topic.trim() || selectedModels.length < 2 || isRunning) return
    setRounds([])
    setCurrentChunks({})
    setScoreboard(null)
    setIsRunning(true)
    abortRef.current = new AbortController()

    const participants: DebateParticipant[] = selectedModels.map((modelId) => ({
      modelId,
      assistantId: modelAssistants[modelId] || undefined,
    }))

    const votingConfig = votingEnabled
      ? { ...getDefaultVotingConfig(), maxParticipants: 6 }
      : { ...getDefaultVotingConfig(), enableVoting: false }

    try {
      await runDebateWithVoting({
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
        votingConfig,
        onVotingComplete: (sb) => setScoreboard(sb),
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

  const consensusReached = scoreboard?.consensusResult?.reached ?? false
  const agreementPercent = scoreboard?.consensusResult
    ? Math.round(scoreboard.consensusResult.agreementScore * 100)
    : 0

  return (
    <div className="debate-view">
      {/* Consensus banner */}
      {scoreboard?.consensusResult && (
        <div
          data-testid="consensus-banner"
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            background: consensusReached ? 'var(--green-dim, rgba(34,197,94,0.15))' : 'var(--yellow-dim, rgba(234,179,8,0.15))',
            border: `1px solid ${consensusReached ? 'var(--green, #22c55e)' : 'var(--yellow, #eab308)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
          }}
        >
          <span style={{ fontWeight: 600, color: consensusReached ? 'var(--green, #22c55e)' : 'var(--yellow, #eab308)' }}>
            {consensusReached ? t('debate.consensusReached') : t('debate.consensus')}
          </span>
          <span
            data-testid="consensus-percentage"
            style={{ fontSize: 11, color: 'var(--text2)' }}
          >
            {agreementPercent}%
          </span>
          {scoreboard.consensusResult.topPosition && (
            <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 'auto' }}>
              {scoreboard.consensusResult.topPosition}
            </span>
          )}
        </div>
      )}

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

      {/* Voting toggle + Start */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
        <label
          data-testid="voting-toggle"
          onClick={() => setVotingEnabled((prev) => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            color: 'var(--text2)',
            cursor: 'pointer',
            marginLeft: 'auto',
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={votingEnabled}
            onChange={(e) => setVotingEnabled(e.target.checked)}
            style={{ width: 14, height: 14, cursor: 'pointer' }}
          />
          {t('debate.votingRound')}
        </label>
      </div>

      {/* Scoreboard */}
      {scoreboard && scoreboard.participants.length > 0 && (
        <div data-testid="scoreboard" style={{ marginTop: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>
            {t('debate.scoreboard')}
          </div>
          <table
            data-testid="scoreboard-table"
            style={{
              width: '100%',
              fontSize: 11,
              borderCollapse: 'collapse',
              color: 'var(--text2)',
            }}
          >
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border2)' }}>
                <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500 }}>{t('debate.rank')}</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500 }}>Model</th>
                <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 500 }}>{t('debate.avgScore')}</th>
              </tr>
            </thead>
            <tbody>
              {scoreboard.participants.map((p) => {
                const model = getModel(p.modelId)
                const color = model ? PROVIDER_COLORS[model.provider] : 'var(--text3)'
                return (
                  <tr key={p.modelId} style={{ borderBottom: '1px solid var(--border1)' }}>
                    <td style={{ padding: '4px 8px', fontWeight: 600 }}>#{p.rank}</td>
                    <td style={{ padding: '4px 8px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
                        {model?.shortLabel ?? p.modelId}
                      </span>
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'var(--mono)' }}>
                      {p.avgScore.toFixed(1)}/5
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

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
                <span style={{ color: 'var(--text3)', fontSize: 10 }}>{'\u00b7'} {t(`debate.roles.${r.role}`)}</span>
                <span style={{ color: 'var(--text3)', fontSize: 10 }}>{'\u00b7'} {t('debate.round', { n: r.round })}</span>
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
                      {text}<span className="cursor">&#9612;</span>
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
