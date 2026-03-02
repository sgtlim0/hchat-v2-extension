import { useState } from 'react'
import type { ToolPanelProps } from './types'

type Props = Pick<ToolPanelProps, 'loading' | 'setResult' | 'runStream' | 't'> & {
  langs: string[]
}

export default function TranslateTool({ loading, setResult, runStream, t, langs }: Props) {
  const [inputText, setInputText] = useState('')
  const [selectedLang, setSelectedLang] = useState(langs[0])

  const handleTranslate = async () => {
    if (!inputText.trim()) { setResult(t('tools.noText')); return }
    await runStream(t('aiPrompts.translateTo', { lang: selectedLang }) + `\n\n${inputText}`)
  }

  return (
    <div className="gap-2">
      <div className="field">
        <label className="field-label">{t('tools.translateTo')}</label>
        <select className="select" value={selectedLang} onChange={(e) => setSelectedLang(e.target.value)}>
          {langs.map((l) => <option key={l}>{l}</option>)}
        </select>
      </div>
      <div className="field">
        <label className="field-label">{t('tools.sourceText')}</label>
        <textarea className="textarea" rows={5} value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder={t('tools.translatePlaceholder')} />
      </div>
      <button className="btn btn-primary" onClick={handleTranslate} disabled={loading}>
        {loading ? <><span className="spinner" /> {t('tools.translating')}</> : t('tools.translateAction', { lang: selectedLang })}
      </button>
    </div>
  )
}
