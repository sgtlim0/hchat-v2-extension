import { ModelSelector } from '../ModelSelector'
import { AssistantSelector } from '../AssistantSelector'
import { ThinkingDepthSelector } from './ThinkingDepthSelector'
import { DeepResearchToggle } from './DeepResearchToggle'
import type { Config } from '../../hooks/useConfig'
import type { ThinkingDepth } from '../../lib/providers/types'
import type { ResearchProgress, SourceRef } from '../../lib/deepResearch'

interface Props {
  currentModel: string
  onModelChange: (model: string) => void
  config: Config
  thinkingDepth: ThinkingDepth
  onThinkingDepthChange: (depth: ThinkingDepth) => void
  assistantId: string
  onAssistantChange: (id: string) => void
  deepResearch: boolean
  onToggleDeepResearch: () => void
  researchProgress: ResearchProgress | null
  researchSources: SourceRef[]
  streamingReport: string
  agentMode: boolean
  voiceMode: boolean
  t: (key: string) => string
}

export function ChatMetaBar({
  currentModel, onModelChange, config,
  thinkingDepth, onThinkingDepthChange,
  assistantId, onAssistantChange,
  deepResearch, onToggleDeepResearch,
  researchProgress, researchSources, streamingReport,
  agentMode, voiceMode, t,
}: Props) {
  return (
    <div className="input-meta">
      <ModelSelector value={currentModel} onChange={onModelChange} config={config} />
      <ThinkingDepthSelector depth={thinkingDepth} onChange={onThinkingDepthChange} model={currentModel} />
      <AssistantSelector value={assistantId} onChange={onAssistantChange} />
      <DeepResearchToggle enabled={deepResearch} onToggle={onToggleDeepResearch} progress={researchProgress} sources={researchSources} streamingReport={streamingReport} />
      {agentMode && <span className="agent-badge">🤖 {t('chat.agentMode')}</span>}
      {voiceMode && <span className="agent-badge voice">🎙️ {t('chat.voiceModeBadge')}</span>}
      <span className="text-xs">{t('chat.promptHint')}</span>
    </div>
  )
}
