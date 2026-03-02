import { useState } from 'react'
import { useLocale } from '../../i18n'
import { detectLanguage } from '../../lib/detectLanguage'

/** Enhanced code block with language label and copy button */
export function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const { t } = useLocale()
  const [copied, setCopied] = useState(false)
  const displayLang = lang || detectLanguage(code)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-block-lang">{displayLang}</span>
        <button className="code-block-copy" onClick={handleCopy}>
          {copied ? `✓ ${t('common.copied')}` : `📋 ${t('common.copy')}`}
        </button>
      </div>
      <pre className="code-block-body"><code>{code}</code></pre>
    </div>
  )
}
