import { useLocale } from '../../i18n'

export function SearchSources({ sources }: { sources: { title: string; url: string }[] }) {
  const { t } = useLocale()
  return (
    <div className="search-sources">
      <span className="search-sources-label">{t('chat.sources')}</span>
      {sources.map((s, i) => (
        <a key={i} href={s.url} target="_blank" rel="noreferrer" className="source-chip" title={s.url}>
          {s.title.slice(0, 30) || new URL(s.url).hostname}
        </a>
      ))}
    </div>
  )
}
