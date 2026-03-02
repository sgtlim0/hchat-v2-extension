import { useState } from 'react'
import { WRITING_ACTIONS, buildWritingPrompt, type WritingAction } from '../../lib/writingTools'
import type { ToolPanelProps } from './types'

type Props = Pick<ToolPanelProps, 'loading' | 'setResult' | 'runStream' | 't'>

export default function WriteTool({ loading, setResult, runStream, t }: Props) {
  const [inputText, setInputText] = useState('')
  const [selectedAction, setSelectedAction] = useState<WritingAction>('paraphrase')

  const handleWrite = async () => {
    if (!inputText.trim()) { setResult(t('tools.noInputText')); return }
    await runStream(buildWritingPrompt(selectedAction, inputText))
  }

  return (
    <div className="gap-2">
      <div className="field">
        <label className="field-label">{t('tools.selectAction')}</label>
        <div className="writing-actions">
          {WRITING_ACTIONS.map((a) => (
            <button
              key={a.id}
              className={`writing-action-btn ${selectedAction === a.id ? 'active' : ''}`}
              onClick={() => setSelectedAction(a.id)}
            >
              <span>{a.emoji}</span>
              <span>{t(`writing.${a.id}`)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label className="field-label">{t('tools.textInput')}</label>
        <textarea className="textarea" rows={5} value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder={t('tools.textPlaceholder')} />
      </div>
      <button className="btn btn-primary" onClick={handleWrite} disabled={loading}>
        {loading ? <><span className="spinner" /> {t('common.processing')}</> : t('tools.executeAction', { action: t(`writing.${selectedAction}`) })}
      </button>
    </div>
  )
}
