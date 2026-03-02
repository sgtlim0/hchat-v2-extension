import { useState } from 'react'
import type { ToolPanelProps } from './types'

type Props = Pick<ToolPanelProps, 'loading' | 'setResult' | 'runStream' | 't'>

export default function GrammarTool({ loading, setResult, runStream, t }: Props) {
  const [inputText, setInputText] = useState('')

  const handleGrammar = async () => {
    if (!inputText.trim()) { setResult(t('tools.noGrammarText')); return }
    await runStream(t('aiPrompts.grammarCheck') + `\n\n${inputText}`)
  }

  return (
    <div className="gap-2">
      <div className="field">
        <label className="field-label">{t('tools.grammarText')}</label>
        <textarea className="textarea" rows={6} value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder={t('tools.grammarPlaceholder')} />
      </div>
      <button className="btn btn-primary" onClick={handleGrammar} disabled={loading}>
        {loading ? <><span className="spinner" /> {t('tools.correcting')}</> : t('tools.grammarAction')}
      </button>
    </div>
  )
}
