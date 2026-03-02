import { useState } from 'react'
import { useLocale } from '../../i18n'
import type { AgentStep } from '../../lib/agent'

export function AgentStepsView({ steps }: { steps: AgentStep[] }) {
  const { t } = useLocale()
  const [expanded, setExpanded] = useState(false)
  const toolSteps = steps.filter((s) => s.type === 'tool_call' || s.type === 'tool_result')
  if (toolSteps.length === 0) return null

  return (
    <div className="agent-steps">
      <button className="agent-steps-toggle" onClick={() => setExpanded(!expanded)}>
        <span>{expanded ? '▼' : '▶'}</span>
        <span>{t('chat.toolUsage', { n: toolSteps.length / 2 })}</span>
      </button>
      {expanded && (
        <div className="agent-steps-list">
          {toolSteps.map((step) => (
            <div key={step.id} className={`agent-step agent-step-${step.type}`}>
              {step.type === 'tool_call' && (
                <>
                  <span className="agent-step-icon">🔧</span>
                  <span className="agent-step-name">{step.toolName}</span>
                  <span className="agent-step-detail">{step.toolInput ? JSON.stringify(step.toolInput).slice(0, 80) : ''}</span>
                </>
              )}
              {step.type === 'tool_result' && (
                <>
                  <span className="agent-step-icon">📋</span>
                  <span className="agent-step-result">{step.content.slice(0, 150)}{step.content.length > 150 ? '...' : ''}</span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
