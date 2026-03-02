import { useState, useCallback, useRef, useMemo } from 'react'
import { useConfig } from '../hooks/useConfig'
import { useShortcuts } from '../hooks/useShortcuts'
import { useLocale } from '../i18n'
import { ChatView } from '../components/ChatView'
import { GroupChatView } from '../components/GroupChatView'
import { ToolsView } from '../components/ToolsView'
import { PromptLibraryView } from '../components/PromptLibraryView'
import { HistoryView } from '../components/HistoryView'
import { SettingsView } from '../components/SettingsView'
import { BookmarksView } from '../components/BookmarksView'
import { DebateView } from '../components/DebateView'
import { MessageSearchModal } from '../components/MessageSearchModal'
import type { ShortcutAction } from '../lib/shortcuts'
import '../styles/global.css'

type Tab = 'chat' | 'group' | 'tools' | 'debate' | 'prompts' | 'history' | 'bookmarks' | 'settings'

const TABS_BASE: { id: Tab; icon: string }[] = [
  { id: 'chat',      icon: '💬' },
  { id: 'group',     icon: '🤖' },
  { id: 'tools',     icon: '🛠' },
  { id: 'debate',    icon: '🎯' },
  { id: 'prompts',   icon: '📚' },
  { id: 'history',   icon: '🕐' },
  { id: 'bookmarks', icon: '🔖' },
  { id: 'settings',  icon: '⚙️' },
]

const TAB_ORDER: Tab[] = TABS_BASE.map((t) => t.id)

export function App() {
  const { t } = useLocale()
  const { config, loaded } = useConfig()
  const [tab, setTab] = useState<Tab>('chat')
  const [loadConvId, setLoadConvId] = useState<string | undefined>()
  const [contextEnabled, setContextEnabled] = useState(true)
  const [showSearch, setShowSearch] = useState(false)
  const chatNewRef = useRef<() => void>()
  const chatStopRef = useRef<() => void>()
  const chatInputRef = useRef<() => void>()
  const hasAnyKey = !!(config.aws.accessKeyId && config.aws.secretAccessKey) || !!config.openai.apiKey || !!config.gemini.apiKey

  const cycleTab = useCallback((dir: 1 | -1) => {
    setTab((current) => {
      const idx = TAB_ORDER.indexOf(current)
      const next = (idx + dir + TAB_ORDER.length) % TAB_ORDER.length
      return TAB_ORDER[next]
    })
  }, [])

  const shortcutActions = useMemo<Partial<Record<ShortcutAction, () => void>>>(() => ({
    'new-chat': () => { setTab('chat'); chatNewRef.current?.() },
    'focus-input': () => { setTab('chat'); chatInputRef.current?.() },
    'stop-generation': () => chatStopRef.current?.(),
    'search-history': () => setShowSearch(true),
    'toggle-context': () => setContextEnabled((v) => !v),
    'next-tab': () => cycleTab(1),
    'prev-tab': () => cycleTab(-1),
  }), [cycleTab])

  useShortcuts(shortcutActions)

  if (!loaded) {
    return (
      <div className="app" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner-sm" />
      </div>
    )
  }

  // First-run: no API key
  if (!hasAnyKey && tab !== 'settings') {
    return (
      <div className="app">
        <div className="topbar">
          <div className="logo">H</div>
          <div className="tab-bar">
            {TABS_BASE.map((tb) => (
              <button key={tb.id} className={`tab-btn ${tab === tb.id ? 'active' : ''}`} onClick={() => setTab(tb.id)}>
                <span className="tab-icon">{tb.icon}</span>
                <span>{t(`tabs.${tb.id}`)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="chat-empty">
            <div className="chat-empty-logo">H</div>
            <h2>{t('welcome.title')}</h2>
            <p>{t('welcome.subtitle')}</p>
            <button className="btn btn-primary btn-lg" style={{ marginTop: 8 }} onClick={() => setTab('settings')}>
              {t('welcome.setupButton')}
            </button>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
              {t('welcome.setupHint')}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="logo">H</div>
        <div className="tab-bar">
          {TABS_BASE.map((tb) => (
            <button
              key={tb.id}
              className={`tab-btn ${tab === tb.id ? 'active' : ''}`}
              onClick={() => setTab(tb.id)}
            >
              <span className="tab-icon">{tb.icon}</span>
              <span>{t(`tabs.${tb.id}`)}</span>
            </button>
          ))}
        </div>
        <div className="topbar-actions">
          <button className="icon-btn" title={t('chat.searchMessages')} onClick={() => setShowSearch(true)}>🔍</button>
        </div>
      </div>

      <MessageSearchModal
        open={showSearch}
        onClose={() => setShowSearch(false)}
        onSelect={(convId) => { setLoadConvId(convId); setTab('chat') }}
      />

      <div className={`content ${tab === 'chat' || tab === 'group' || tab === 'debate' ? 'flex-col' : ''}`}>
        {tab === 'chat' && (
          <ChatView
            config={config}
            loadConvId={loadConvId}
            onNewConv={() => setLoadConvId(undefined)}
            contextEnabled={contextEnabled}
            onToggleContext={() => setContextEnabled((v) => !v)}
            onRegisterActions={(actions) => {
              chatNewRef.current = actions.startNew
              chatStopRef.current = actions.stop
              chatInputRef.current = actions.focusInput
            }}
            onForkConv={(id) => { setLoadConvId(id); setTab('chat') }}
          />
        )}
        {tab === 'group' && <GroupChatView config={config} />}
        {tab === 'tools' && <ToolsView config={config} />}
        {tab === 'debate' && <DebateView config={config} />}
        {tab === 'prompts' && (
          <PromptLibraryView
            onUsePrompt={(_content) => {
              setTab('chat')
              // TODO: pass to chat view
            }}
          />
        )}
        {tab === 'history' && (
          <HistoryView
            activeId={loadConvId}
            onSelect={(id) => {
              setLoadConvId(id)
              setTab('chat')
            }}
          />
        )}
        {tab === 'bookmarks' && <BookmarksView />}
        {tab === 'settings' && <SettingsView />}
      </div>
    </div>
  )
}
