import { useState } from 'react'
import { useLocale } from '../../i18n'

/** Simple language detection from code content */
export function detectLanguage(code: string): string {
  if (/^(import |from |export |const |let |var |function |class |=>)/.test(code)) return 'javascript'
  if (/^(def |class |import |from |print\(|if __name__)/.test(code)) return 'python'
  if (/<\/?[a-z][\s\S]*>/i.test(code) && /<\/[a-z]+>/i.test(code)) return 'html'
  if (/^\s*\{[\s\S]*"[^"]+"\s*:/.test(code)) return 'json'
  if (/^(SELECT |INSERT |UPDATE |DELETE |CREATE |ALTER )/i.test(code)) return 'sql'
  if (/^#include|^int main\(|^void |^printf\(/.test(code)) return 'c'
  if (/^package |^func |^type |^import \(/.test(code)) return 'go'
  if (/^\s*[\w-]+\s*\{[\s\S]*\}/.test(code) && /:\s*[^;]+;/.test(code)) return 'css'
  return 'code'
}

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
