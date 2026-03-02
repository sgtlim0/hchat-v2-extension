# H Chat v2 - 추가 기능 상세 기술 설계

> 마지막 업데이트: 2026-03-03
> 현재 버전: v4.2
> 참고: 이 문서는 v2~v3 초기 설계안입니다. 대부분 기능이 v3.x~v4.x에서 구현 완료되었습니다.

## 기존 아키텍처 요약 (v4.2 기준)

| 모듈 | 역할 |
|------|------|
| `providers/` | Bedrock/OpenAI/Gemini 프로바이더 추상화 |
| `ChatHistory` | `hchat:conv:*` 기반 대화 CRUD |
| `useChat` hook | 대화 상태, 스트리밍, 중단 관리, 비서 통합 |
| `pageReader` | 페이지/YouTube 컨텐츠 추출 (구조화 자막 포함) |
| `ToolsView` | 15개 도구 (요약, 멀티탭, YouTube, OCR, 배치OCR, 번역, 글쓰기, 문서작성, 문법, 댓글분석, PDF, 인사이트, 데이터분석, 이미지생성, 문서번역) |
| `App.tsx` | 8탭: chat, group, tools, debate, prompts, history, bookmarks, settings |

---

## 구현 상태 요약

아래 6개 기능 중 대부분이 v3.x~v4.x에서 구현 완료되었습니다.

| Feature | 구현 상태 | 버전 |
|---------|----------|------|
| Feature 1: 웹 검색 통합 | ✅ 완료 | v2 (기초), v3.1 (딥 리서치) |
| Feature 2: 사이드바 컨텍스트 | ✅ 완료 | v3.0 (pageContext) |
| Feature 3: 멀티턴 에이전트 | ✅ 완료 | v2 (기초), v3.6 (플러그인 도구) |
| Feature 4: 스마트 북마크 | ✅ 완료 | v2 (기초) |
| Feature 5: 키보드 단축키 | ⚠️ 부분 완료 | v3.3 (내비게이션만) |
| Feature 6: 대화 내보내기 | ✅ 완료 | v3.0 (5가지 포맷) |

---

## Feature 1: 웹 검색 통합 (Web Search + RAG) ✅ 완료 (v2 기초, v3.1 딥 리서치)

### 구현 상태
- ✅ `webSearch.ts` — DuckDuckGo + Google CSE
- ✅ `searchIntent.ts` — 검색 의도 판단
- ✅ `deepResearch.ts` — 3단계 멀티스텝 리서치
- ✅ RAG 컨텍스트 자동 주입

### 아키텍처

```
[사용자 질문] → [검색 의도 판단] → [Web Search API] → [결과 요약] → [RAG 프롬프트 생성] → [LLM 응답]
```

### 새 파일

#### `src/lib/webSearch.ts`

```typescript
export interface SearchResult {
  title: string
  url: string
  snippet: string
  content?: string  // 전체 텍스트 (크롤링 시)
}

export interface SearchOptions {
  query: string
  maxResults?: number  // default: 5
  language?: string    // default: 'ko'
}

// Google Custom Search JSON API (무료 100회/일) 또는 SearXNG self-hosted
export async function webSearch(opts: SearchOptions): Promise<SearchResult[]>

// 검색 결과 URL에서 본문 추출 (background script 경유)
export async function fetchPageContent(url: string): Promise<string>

// RAG 컨텍스트 빌드: 검색 결과 → 프롬프트 삽입용 텍스트
export function buildSearchContext(results: SearchResult[]): string
```

#### `src/lib/searchIntent.ts`

```typescript
// 질문이 웹 검색이 필요한지 판단 (LLM 호출 없이 규칙 기반)
export function needsWebSearch(query: string): boolean {
  const patterns = [
    /최신|최근|오늘|이번\s?주|2025|2026/,
    /가격|환율|날씨|뉴스|주가/,
    /누구|어디|몇/,
    /검색해|찾아|알려줘.*최신/,
  ]
  return patterns.some(p => p.test(query))
}

// 사용자 질문 → 검색 쿼리 변환 (간단한 키워드 추출)
export function extractSearchQuery(userMessage: string): string
```

### 기존 파일 수정

#### `src/hooks/useChat.ts` — `sendMessage` 확장

```typescript
const sendMessage = async (text: string, opts?) => {
  // 1. 검색 의도 판단
  const searchEnabled = config.enableWebSearch
  if (searchEnabled && needsWebSearch(text)) {
    // 2. 검색 실행
    const query = extractSearchQuery(text)
    const results = await webSearch({ query, maxResults: 5 })
    const context = buildSearchContext(results)

    // 3. 시스템 프롬프트에 검색 컨텍스트 삽입
    const searchSystemPrompt = `다음 웹 검색 결과를 참고하여 답변하세요. 출처를 인용하세요.\n\n${context}`

    // 4. 기존 streamChatLive 호출 (systemPrompt 추가)
    await streamChatLive({ ...baseOpts, systemPrompt: searchSystemPrompt })
  }
}
```

#### `src/components/ChatView.tsx` — 검색 인디케이터

```typescript
// 메시지 버블에 "🔍 웹 검색 중..." 상태 표시
// 검색 결과 출처 링크를 메시지 하단에 표시
{msg.searchSources && (
  <div className="search-sources">
    {msg.searchSources.map(s => (
      <a href={s.url} className="source-chip">{s.title}</a>
    ))}
  </div>
)}
```

#### `src/lib/chatHistory.ts` — ChatMessage 타입 확장

```typescript
interface ChatMessage {
  // ... 기존 필드
  searchSources?: { title: string; url: string }[]  // 검색 출처
}
```

#### `src/components/SettingsView.tsx` — 설정 추가

```typescript
// Web Search 섹션
// - enableWebSearch: boolean (토글)
// - searchApiKey: string (Google Custom Search API 키)
// - searchEngineId: string (Google CSE ID)
// - autoSearch: boolean (자동 검색 vs 수동 트리거)
```

### 검색 API 선택지

| API | 무료 한도 | 장점 | 단점 |
|-----|-----------|------|------|
| Google Custom Search | 100회/일 | 안정적 | API 키 필요 |
| DuckDuckGo Instant | 무제한 | 키 불필요 | 정확도 낮음 |
| Brave Search | 2000회/월 | 품질 좋음 | 가입 필요 |
| SearXNG (self-hosted) | 무제한 | 프라이버시 | 서버 필요 |

**권장**: DuckDuckGo를 기본, Google CSE를 옵션으로 제공.

### Storage 키

```
hchat:config.enableWebSearch    → boolean
hchat:config.searchApiKey       → string
hchat:config.searchEngineId     → string
hchat:search-cache:{queryHash}  → { results, ts }  // 1시간 캐시
```

---

## Feature 2: 사이드바 채팅 컨텍스트 ✅ 완료 (v3.0)

### 구현 상태
- ✅ `pageContext.ts` — 페이지 타입 감지 (article/code/video/social)
- ✅ `content/index.ts` — MutationObserver 페이지 변경 감지
- ✅ `useChat.ts` — 페이지 컨텍스트 자동 주입
- ✅ ChatView 컨텍스트 토글 UI

### 아키텍처

```
[탭 활성화] → [content script 페이지 추출] → [storage 업데이트] → [sidepanel 감지] → [시스템 프롬프트 주입]
```

### 새 파일

#### `src/lib/pageContext.ts`

```typescript
export interface PageContext {
  url: string
  title: string
  text: string          // 페이지 본문 (max 4000자)
  selection?: string    // 선택 텍스트
  meta?: {
    description?: string
    author?: string
    publishedDate?: string
    type?: string       // 'article' | 'docs' | 'code' | 'video' | 'social'
  }
  ts: number
}

// 페이지 타입 자동 감지
export function detectPageType(url: string, doc: Document): PageContext['meta']['type'] {
  if (/github\.com|gitlab\.com/.test(url)) return 'code'
  if (/youtube\.com|vimeo\.com/.test(url)) return 'video'
  if (/twitter\.com|x\.com|reddit\.com/.test(url)) return 'social'
  if (doc.querySelector('article')) return 'article'
  if (doc.querySelector('pre code')) return 'docs'
  return 'article'
}

// 페이지 컨텍스트 → 시스템 프롬프트 변환
export function buildPageSystemPrompt(ctx: PageContext): string {
  return [
    `현재 사용자가 보고 있는 페이지:`,
    `- 제목: ${ctx.title}`,
    `- URL: ${ctx.url}`,
    `- 유형: ${ctx.meta?.type ?? 'unknown'}`,
    ctx.selection ? `- 선택한 텍스트: "${ctx.selection}"` : '',
    `\n페이지 내용 (발췌):\n${ctx.text.slice(0, 3000)}`,
    `\n이 컨텍스트를 참고하여 사용자의 질문에 답변하세요.`,
  ].filter(Boolean).join('\n')
}
```

### 기존 파일 수정

#### `src/content/index.ts` — 페이지 변경 감지

```typescript
// MutationObserver + visibilitychange 로 SPA 네비게이션 감지
let lastUrl = location.href

const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href
    updatePageContext()
  }
})

observer.observe(document.body, { childList: true, subtree: true })

// 텍스트 선택 이벤트 → 실시간 컨텍스트 업데이트
document.addEventListener('mouseup', debounce(() => {
  const sel = window.getSelection()?.toString().trim()
  if (sel && sel.length > 10) {
    chrome.storage.local.set({
      'hchat:page-context-selection': sel
    })
  }
}, 500))

function updatePageContext() {
  const ctx: PageContext = {
    url: location.href,
    title: document.title,
    text: extractMainContent(),  // 기존 pageReader 로직 재사용
    meta: { type: detectPageType(location.href, document) },
    ts: Date.now()
  }
  chrome.storage.local.set({ 'hchat:page-context': ctx })
}
```

#### `src/background/index.ts` — 탭 전환 리스너

```typescript
// 탭 활성화 시 해당 탭의 content script에 컨텍스트 업데이트 요청
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'update-page-context' })
  } catch {
    // content script 미로드 탭 무시
  }
})
```

#### `src/hooks/useChat.ts` — 컨텍스트 자동 주입

```typescript
// usePageContext 훅 또는 useChat 내부에서
const [pageContext, setPageContext] = useState<PageContext | null>(null)

useEffect(() => {
  const handler = (changes: Record<string, chrome.storage.StorageChange>) => {
    if (changes['hchat:page-context']) {
      setPageContext(changes['hchat:page-context'].newValue)
    }
  }
  chrome.storage.local.onChanged.addListener(handler)
  return () => chrome.storage.local.onChanged.removeListener(handler)
}, [])

// sendMessage에서 pageContext가 있으면 시스템 프롬프트에 주입
const systemPrompt = contextEnabled && pageContext
  ? buildPageSystemPrompt(pageContext)
  : undefined
```

#### `src/sidepanel/App.tsx` — 컨텍스트 토글 UI

```typescript
// 채팅 탭 상단에 컨텍스트 표시 바
<div className="context-bar">
  <span className="context-icon">📄</span>
  <span className="context-title">{pageContext?.title}</span>
  <button onClick={() => setContextEnabled(!contextEnabled)}>
    {contextEnabled ? '🔗' : '🔓'}
  </button>
</div>
```

### Storage 키

```
hchat:page-context              → PageContext  // 현재 페이지 컨텍스트
hchat:page-context-selection    → string       // 선택 텍스트
hchat:config.enablePageContext   → boolean      // 토글
```

---

## Feature 3: 멀티턴 에이전트 모드 ✅ 완료 (v2 기초, v3.6 플러그인)

### 구현 상태
- ✅ `agent.ts` — 10스텝 에이전트 루프
- ✅ `agentTools.ts` — 5개 내장 도구 (web_search, read_page, fetch_url, calculate, javascript_eval)
- ✅ `pluginRegistry.ts` — 커스텀 플러그인 시스템 (webhook/JS/prompt)
- ✅ ChatView 에이전트 모드 토글
- ✅ 도구 호출 스텝 UI

### 아키텍처

```
[사용자 요청] → [에이전트 루프] ↔ [도구 호출] → [결과 수집] → [최종 응답]
                    ↑                    ↓
                    ←── [도구 결과] ←────┘
```

### 새 파일

#### `src/lib/agent.ts`

```typescript
export interface Tool {
  name: string
  description: string
  parameters: Record<string, { type: string; description: string; required?: boolean }>
  execute: (params: Record<string, unknown>) => Promise<string>
}

export interface AgentStep {
  id: string
  type: 'thinking' | 'tool_call' | 'tool_result' | 'response'
  content: string
  toolName?: string
  toolInput?: Record<string, unknown>
  ts: number
}

export interface AgentOptions {
  apiKeys: Partial<Record<Provider, string>>
  model: string
  userMessage: string
  tools: Tool[]
  maxSteps?: number      // default: 10
  onStep: (step: AgentStep) => void
  signal?: AbortSignal
}

// 에이전트 루프: 도구 호출 → 결과 수집 → 다음 판단 반복
export async function runAgent(opts: AgentOptions): Promise<string> {
  const { tools, maxSteps = 10, onStep, signal } = opts
  const history: Message[] = [
    { role: 'system', content: buildAgentSystemPrompt(tools) },
    { role: 'user', content: opts.userMessage }
  ]

  for (let step = 0; step < maxSteps; step++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    // LLM 호출 (tool_use 포맷 사용)
    const response = await callWithTools(history, opts)

    // 도구 호출 파싱
    const toolCalls = parseToolCalls(response)

    if (toolCalls.length === 0) {
      // 최종 응답 (도구 호출 없음)
      onStep({ id: uid(), type: 'response', content: response, ts: Date.now() })
      return response
    }

    // 도구 실행
    for (const call of toolCalls) {
      onStep({ id: uid(), type: 'tool_call', content: `${call.name}(${JSON.stringify(call.input)})`, toolName: call.name, toolInput: call.input, ts: Date.now() })

      const tool = tools.find(t => t.name === call.name)
      const result = tool ? await tool.execute(call.input) : `Tool "${call.name}" not found`

      onStep({ id: uid(), type: 'tool_result', content: result, toolName: call.name, ts: Date.now() })

      // 히스토리에 도구 결과 추가
      history.push({ role: 'assistant', content: response })
      history.push({ role: 'user', content: `[Tool Result: ${call.name}]\n${result}` })
    }
  }

  return 'Maximum steps reached.'
}
```

#### `src/lib/agentTools.ts`

```typescript
import { webSearch } from './webSearch'
import { getCurrentPageContent } from './pageReader'

export const BUILTIN_TOOLS: Tool[] = [
  {
    name: 'web_search',
    description: '웹에서 최신 정보를 검색합니다',
    parameters: {
      query: { type: 'string', description: '검색 쿼리', required: true }
    },
    execute: async (params) => {
      const results = await webSearch({ query: params.query as string })
      return results.map(r => `[${r.title}](${r.url})\n${r.snippet}`).join('\n\n')
    }
  },
  {
    name: 'read_page',
    description: '현재 보고 있는 웹페이지의 내용을 읽습니다',
    parameters: {},
    execute: async () => {
      const page = await getCurrentPageContent()
      return `Title: ${page.title}\nURL: ${page.url}\n\n${page.text}`
    }
  },
  {
    name: 'fetch_url',
    description: '지정된 URL의 웹페이지 내용을 가져옵니다',
    parameters: {
      url: { type: 'string', description: 'URL', required: true }
    },
    execute: async (params) => {
      const resp = await fetch(params.url as string)
      const html = await resp.text()
      // 간단한 HTML → 텍스트 변환
      const doc = new DOMParser().parseFromString(html, 'text/html')
      return doc.body.innerText.slice(0, 6000)
    }
  },
  {
    name: 'javascript_eval',
    description: '간단한 JavaScript 코드를 실행합니다 (계산, 데이터 변환 등)',
    parameters: {
      code: { type: 'string', description: 'JavaScript 코드', required: true }
    },
    execute: async (params) => {
      try {
        // sandboxed eval via background script
        const result = await chrome.runtime.sendMessage({
          type: 'eval-js',
          code: params.code as string
        })
        return String(result)
      } catch (e) {
        return `Error: ${e}`
      }
    }
  },
]
```

### 기존 파일 수정

#### `src/hooks/useChat.ts` — 에이전트 모드 분기

```typescript
const sendMessage = async (text: string, opts?) => {
  if (agentMode) {
    // 에이전트 루프 실행
    const steps: AgentStep[] = []
    await runAgent({
      apiKeys: config.apiKeys,
      model: currentModel,
      userMessage: text,
      tools: BUILTIN_TOOLS,
      maxSteps: 10,
      onStep: (step) => {
        steps.push(step)
        // 실시간 UI 업데이트 (스트리밍과 유사)
        updateStreamingMessage(formatAgentSteps(steps))
      },
      signal: abortRef.current.signal
    })
  } else {
    // 기존 단순 채팅
    await streamChatLive(...)
  }
}
```

#### `src/components/ChatView.tsx` — 에이전트 스텝 UI

```typescript
// 에이전트 모드 토글 버튼 (입력 영역 옆)
<button
  className={`agent-toggle ${agentMode ? 'active' : ''}`}
  onClick={() => setAgentMode(!agentMode)}
  title="에이전트 모드"
>
  🤖
</button>

// 에이전트 스텝 표시 (접기/펼치기)
{msg.agentSteps && (
  <div className="agent-steps">
    {msg.agentSteps.map(step => (
      <div key={step.id} className={`step step-${step.type}`}>
        {step.type === 'tool_call' && <span>🔧 {step.toolName}</span>}
        {step.type === 'tool_result' && <span>📋 결과</span>}
        {step.type === 'thinking' && <span>💭 사고 중...</span>}
        <pre>{step.content.slice(0, 200)}</pre>
      </div>
    ))}
  </div>
)}
```

#### `src/lib/chatHistory.ts` — ChatMessage 확장

```typescript
interface ChatMessage {
  // ... 기존 필드
  agentSteps?: AgentStep[]
}
```

### Claude Tool Use vs 텍스트 기반 파싱

| 방식 | Claude | OpenAI | Gemini |
|------|--------|--------|--------|
| Native Tool Use | `tool_use` content block | `tool_calls` in response | `functionCall` in part |
| 텍스트 파싱 | `<tool>...</tool>` XML 파싱 | 동일 | 동일 |

**권장**: 각 프로바이더의 네이티브 도구 호출 포맷을 사용하되, 텍스트 파싱을 fallback으로.

---

## Feature 4: 스마트 북마크 / 하이라이트 ✅ 완료 (v2)

### 구현 상태
- ✅ `bookmarks.ts` — 하이라이트 CRUD
- ✅ `content/toolbar.ts` — 하이라이트 버튼
- ✅ XPath 기반 하이라이트 복원
- ✅ BookmarksView — 검색/필터/태그
- ✅ AI 주석 생성 (generateAiNote)

### 아키텍처

```
[텍스트 선택] → [하이라이트 저장] → [AI 주석 생성(옵션)] → [storage 저장]
[북마크 관리탭] → [검색/필터] → [원본 페이지로 이동 + 하이라이트 복원]
```

### 새 파일

#### `src/lib/bookmarks.ts`

```typescript
export interface Highlight {
  id: string
  url: string
  title: string
  text: string            // 하이라이트된 텍스트
  note?: string           // 사용자 메모
  aiSummary?: string      // AI 생성 요약/주석
  color: HighlightColor
  xpath: string           // DOM 위치 (복원용)
  textOffset: number      // 텍스트 내 오프셋
  tags: string[]
  createdAt: number
  updatedAt: number
}

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple'

export interface BookmarkCollection {
  id: string
  name: string
  description?: string
  highlightIds: string[]
  createdAt: number
}

// CRUD
export const Bookmarks = {
  async list(filters?: { url?: string; tag?: string; query?: string }): Promise<Highlight[]>,
  async add(highlight: Omit<Highlight, 'id' | 'createdAt' | 'updatedAt'>): Promise<Highlight>,
  async update(id: string, patch: Partial<Highlight>): Promise<void>,
  async delete(id: string): Promise<void>,
  async search(query: string): Promise<Highlight[]>,  // 텍스트 + 메모 + AI 요약 검색
  async getByUrl(url: string): Promise<Highlight[]>,   // 특정 페이지 하이라이트
  async generateAiNote(text: string, config: Config): Promise<string>,  // AI 주석 생성
}
```

### 기존 파일 수정

#### `src/content/toolbar.ts` — 하이라이트 기능 추가

```typescript
// 텍스트 선택 시 툴바에 하이라이트 버튼 추가
const highlightBtn = document.createElement('button')
highlightBtn.className = 'hchat-toolbar-btn'
highlightBtn.innerHTML = '🖍️'
highlightBtn.title = '하이라이트 저장'

highlightBtn.addEventListener('click', () => {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return

  const range = selection.getRangeAt(0)
  const text = selection.toString().trim()

  // XPath 계산 (하이라이트 복원용)
  const xpath = getXPathForElement(range.startContainer)

  // 하이라이트 시각 표시
  const mark = document.createElement('mark')
  mark.className = 'hchat-highlight hchat-highlight-yellow'
  mark.dataset.highlightId = uid()
  range.surroundContents(mark)

  // Storage에 저장
  chrome.runtime.sendMessage({
    type: 'save-highlight',
    data: { text, url: location.href, title: document.title, xpath, color: 'yellow' }
  })
})
```

#### `src/content/index.ts` — 하이라이트 복원

```typescript
// 페이지 로드 시 해당 URL의 하이라이트 복원
async function restoreHighlights() {
  const highlights = await chrome.runtime.sendMessage({
    type: 'get-highlights',
    url: location.href
  })

  for (const h of highlights) {
    try {
      const node = document.evaluate(h.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
      if (!node) continue

      // Range로 하이라이트 복원
      const range = document.createRange()
      range.setStart(node, h.textOffset)
      range.setEnd(node, h.textOffset + h.text.length)

      const mark = document.createElement('mark')
      mark.className = `hchat-highlight hchat-highlight-${h.color}`
      mark.dataset.highlightId = h.id
      range.surroundContents(mark)
    } catch { /* DOM 변경으로 복원 실패 시 무시 */ }
  }
}
```

#### `src/sidepanel/App.tsx` — 북마크 탭 추가

```typescript
// 기존 6탭 → 7탭
type Tab = 'chat' | 'group' | 'tools' | 'prompts' | 'history' | 'bookmarks' | 'settings'

const TABS = [
  // ...기존 5개
  { id: 'bookmarks', icon: '🔖', label: '북마크' },
  { id: 'settings',  icon: '⚙️', label: '설정' },
]
```

#### 새 컴포넌트: `src/components/BookmarksView.tsx`

```typescript
export function BookmarksView({ config }: { config: Config }) {
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  return (
    <div className="bookmarks-view">
      {/* 검색 바 */}
      <input placeholder="하이라이트 검색..." value={searchQuery} onChange={...} />

      {/* 태그 필터 */}
      <div className="tag-chips">{/* 태그 목록 */}</div>

      {/* 하이라이트 카드 목록 */}
      {highlights.map(h => (
        <div key={h.id} className="highlight-card">
          <div className={`highlight-color color-${h.color}`} />
          <div className="highlight-content">
            <blockquote>{h.text}</blockquote>
            {h.aiSummary && <p className="ai-note">🤖 {h.aiSummary}</p>}
            {h.note && <p className="user-note">📝 {h.note}</p>}
            <div className="highlight-meta">
              <a href={h.url}>{h.title}</a>
              <span>{timeAgo(h.createdAt)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
```

### Storage 키

```
hchat:highlights          → Highlight[]           // 전체 하이라이트
hchat:highlight-index     → { id, url, ts }[]     // 인덱스 (빠른 조회)
hchat:collections         → BookmarkCollection[]   // 컬렉션
```

---

## Feature 5: 키보드 단축키 시스템 ⚠️ 부분 완료 (v3.3)

### 구현 상태
- ✅ 키보드 내비게이션 (탭 전환, 입력창 포커스)
- ⚠️ 커스터마이징 미구현
- ⚠️ Chrome commands API 미등록
- ✅ useShortcuts 훅 패턴 준비됨

### 새 파일

#### `src/lib/shortcuts.ts`

```typescript
export interface Shortcut {
  id: string
  keys: string           // 'Ctrl+Shift+H', 'Alt+S' 등
  action: ShortcutAction
  description: string
  scope: 'global' | 'sidepanel' | 'content'
  customizable: boolean
}

export type ShortcutAction =
  | 'open-sidepanel'
  | 'new-chat'
  | 'toggle-agent'
  | 'focus-input'
  | 'toggle-context'
  | 'search-history'
  | 'quick-summarize'
  | 'quick-translate'
  | 'toggle-dark-mode'
  | 'stop-generation'
  | 'next-tab'
  | 'prev-tab'
  | 'close-modal'

export const DEFAULT_SHORTCUTS: Shortcut[] = [
  // 전역 (Chrome 커맨드)
  { id: 'open-sidepanel',    keys: 'Ctrl+Shift+H', action: 'open-sidepanel',   description: '사이드패널 열기/닫기', scope: 'global', customizable: true },
  { id: 'quick-summarize',   keys: 'Ctrl+Shift+S', action: 'quick-summarize',  description: '현재 페이지 요약', scope: 'global', customizable: true },

  // 사이드패널 내
  { id: 'new-chat',          keys: 'Ctrl+N',       action: 'new-chat',         description: '새 대화', scope: 'sidepanel', customizable: true },
  { id: 'focus-input',       keys: '/',             action: 'focus-input',      description: '입력창 포커스', scope: 'sidepanel', customizable: false },
  { id: 'toggle-agent',      keys: 'Ctrl+Shift+A', action: 'toggle-agent',     description: '에이전트 모드 토글', scope: 'sidepanel', customizable: true },
  { id: 'search-history',    keys: 'Ctrl+K',       action: 'search-history',   description: '대화 기록 검색', scope: 'sidepanel', customizable: true },
  { id: 'stop-generation',   keys: 'Escape',       action: 'stop-generation',  description: '응답 생성 중지', scope: 'sidepanel', customizable: false },
  { id: 'next-tab',          keys: 'Ctrl+Tab',     action: 'next-tab',         description: '다음 탭', scope: 'sidepanel', customizable: false },
  { id: 'prev-tab',          keys: 'Ctrl+Shift+Tab', action: 'prev-tab',      description: '이전 탭', scope: 'sidepanel', customizable: false },
  { id: 'toggle-dark-mode',  keys: 'Ctrl+Shift+D', action: 'toggle-dark-mode', description: '다크모드 전환', scope: 'sidepanel', customizable: true },
]

// 키 조합 파싱/매칭
export function parseKeyCombo(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')
  if (e.key !== 'Control' && e.key !== 'Shift' && e.key !== 'Alt' && e.key !== 'Meta') {
    parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key)
  }
  return parts.join('+')
}

export function matchShortcut(e: KeyboardEvent, shortcuts: Shortcut[]): Shortcut | undefined {
  const combo = parseKeyCombo(e)
  return shortcuts.find(s => s.keys === combo)
}
```

#### `src/hooks/useShortcuts.ts`

```typescript
export function useShortcuts(
  actions: Record<ShortcutAction, () => void>,
  scope: 'sidepanel' | 'content' = 'sidepanel'
) {
  const [shortcuts, setShortcuts] = useState(DEFAULT_SHORTCUTS)

  useEffect(() => {
    // 커스텀 단축키 로드
    chrome.storage.local.get('hchat:shortcuts', (r) => {
      if (r['hchat:shortcuts']) setShortcuts(r['hchat:shortcuts'])
    })
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 입력 필드에서는 일부 단축키 무시
      const isInput = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)

      const matched = matchShortcut(e, shortcuts.filter(s => s.scope === scope))
      if (!matched) return
      if (isInput && matched.keys.length === 1) return  // 단일키는 입력 중 무시

      e.preventDefault()
      actions[matched.action]?.()
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [shortcuts, actions, scope])

  return shortcuts
}
```

### 기존 파일 수정

#### `manifest.json` — Chrome 커맨드 등록

```json
{
  "commands": {
    "_execute_action": {
      "suggested_key": { "default": "Ctrl+Shift+H", "mac": "MacCtrl+Shift+H" },
      "description": "H Chat 사이드패널 열기"
    },
    "quick-summarize": {
      "suggested_key": { "default": "Ctrl+Shift+S", "mac": "MacCtrl+Shift+S" },
      "description": "현재 페이지 빠른 요약"
    }
  }
}
```

#### `src/sidepanel/App.tsx` — 단축키 바인딩

```typescript
const shortcuts = useShortcuts({
  'new-chat': () => chat.startNew(),
  'focus-input': () => inputRef.current?.focus(),
  'toggle-agent': () => setAgentMode(!agentMode),
  'search-history': () => setTab('history'),
  'stop-generation': () => chat.stop(),
  'next-tab': () => cycleTab(1),
  'prev-tab': () => cycleTab(-1),
  'toggle-dark-mode': () => toggleDarkMode(),
  'toggle-context': () => setContextEnabled(!contextEnabled),
})
```

#### `src/components/SettingsView.tsx` — 단축키 설정 UI

```typescript
// 키보드 단축키 탭
{shortcuts.filter(s => s.customizable).map(s => (
  <div key={s.id} className="shortcut-row">
    <span>{s.description}</span>
    <button
      className="key-recorder"
      onClick={() => startRecording(s.id)}
    >
      <kbd>{s.keys}</kbd>
    </button>
  </div>
))}
```

### Storage 키

```
hchat:shortcuts → Shortcut[]  // 커스텀 단축키 (기본값 override)
```

---

## Feature 6: 대화 내보내기 / 공유 ✅ 완료 (v3.0)

### 구현 상태
- ✅ `exportChat.ts` — 5가지 포맷 (markdown/html/json/txt/pdf)
- ✅ `importChat.ts` — ChatGPT/Claude 대화 가져오기 (v3.5)
- ✅ ChatView 내보내기 버튼
- ✅ 클립보드 복사
- ✅ HistoryView 일괄 내보내기

### 새 파일

#### `src/lib/exportChat.ts`

```typescript
export type ExportFormat = 'markdown' | 'html' | 'json' | 'txt' | 'pdf'

export interface ExportOptions {
  format: ExportFormat
  conversation: Conversation
  includeSystemPrompts?: boolean
  includeTimestamps?: boolean
  includeModelInfo?: boolean
  includeAgentSteps?: boolean
}

export async function exportConversation(opts: ExportOptions): Promise<Blob> {
  switch (opts.format) {
    case 'markdown':
      return exportAsMarkdown(opts)
    case 'html':
      return exportAsHtml(opts)
    case 'json':
      return exportAsJson(opts)
    case 'txt':
      return exportAsPlainText(opts)
    case 'pdf':
      return exportAsPdf(opts)
  }
}

function exportAsMarkdown(opts: ExportOptions): Blob {
  const { conversation: conv, includeTimestamps, includeModelInfo } = opts
  const lines: string[] = [
    `# ${conv.title}`,
    '',
    includeModelInfo ? `> Model: ${conv.model} | Created: ${new Date(conv.createdAt).toLocaleDateString('ko-KR')}` : '',
    '',
    '---',
    '',
  ]

  for (const msg of conv.messages) {
    const prefix = msg.role === 'user' ? '## 🧑 사용자' : '## 🤖 어시스턴트'
    const timestamp = includeTimestamps ? ` (${new Date(msg.ts).toLocaleString('ko-KR')})` : ''

    lines.push(`${prefix}${timestamp}`)
    lines.push('')
    lines.push(msg.content)
    lines.push('')
  }

  return new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
}

function exportAsHtml(opts: ExportOptions): Blob {
  const { conversation: conv } = opts
  // 스타일 포함 HTML (인쇄/공유용)
  const html = `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="utf-8">
      <title>${conv.title}</title>
      <style>
        body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; }
        .msg { margin: 16px 0; padding: 12px 16px; border-radius: 12px; }
        .msg-user { background: #3478FE; color: white; margin-left: 48px; }
        .msg-ai { background: #F3F4F6; margin-right: 48px; }
        pre { background: #1E1E1E; color: #D4D4D4; padding: 12px; border-radius: 8px; overflow-x: auto; }
        code { font-family: 'SF Mono', Consolas, monospace; }
        h1 { text-align: center; }
        .meta { text-align: center; color: #6B7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <h1>${conv.title}</h1>
      <p class="meta">${conv.model} · ${new Date(conv.createdAt).toLocaleDateString('ko-KR')}</p>
      <hr>
      ${conv.messages.map(msg => `
        <div class="msg msg-${msg.role === 'user' ? 'user' : 'ai'}">
          ${msg.content.replace(/\n/g, '<br>')}
        </div>
      `).join('')}
    </body>
    </html>
  `
  return new Blob([html], { type: 'text/html;charset=utf-8' })
}

function exportAsJson(opts: ExportOptions): Blob {
  const data = {
    exportedAt: new Date().toISOString(),
    version: '2.0',
    conversation: opts.conversation,
  }
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
}

function exportAsPlainText(opts: ExportOptions): Blob {
  const lines = opts.conversation.messages.map(msg => {
    const role = msg.role === 'user' ? '사용자' : '어시스턴트'
    return `[${role}]\n${msg.content}\n`
  })
  return new Blob([lines.join('\n---\n\n')], { type: 'text/plain;charset=utf-8' })
}

// PDF: HTML → print로 대체 (라이브러리 의존성 없이)
function exportAsPdf(opts: ExportOptions): Blob {
  // HTML 내보내기 후 window.print() 호출로 PDF 생성 유도
  return exportAsHtml(opts)
}

// 파일 다운로드 트리거
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// 클립보드 복사 (마크다운)
export async function copyToClipboard(conv: Conversation): Promise<void> {
  const blob = await exportConversation({
    format: 'markdown',
    conversation: conv,
    includeTimestamps: false,
  })
  const text = await blob.text()
  await navigator.clipboard.writeText(text)
}
```

### 기존 파일 수정

#### `src/components/ChatView.tsx` — 내보내기 버튼

```typescript
// 채팅 헤더에 내보내기/공유 버튼
<div className="chat-header-actions">
  <button onClick={() => setShowExportMenu(!showExportMenu)} title="내보내기">
    📤
  </button>
  {showExportMenu && (
    <div className="export-menu">
      <button onClick={() => handleExport('markdown')}>📝 Markdown</button>
      <button onClick={() => handleExport('html')}>🌐 HTML</button>
      <button onClick={() => handleExport('json')}>📦 JSON</button>
      <button onClick={() => handleExport('txt')}>📄 텍스트</button>
      <div className="divider" />
      <button onClick={() => handleCopyAll()}>📋 클립보드 복사</button>
    </div>
  )}
</div>
```

#### `src/components/HistoryView.tsx` — 일괄 내보내기

```typescript
// 대화 기록에서 선택 → 일괄 내보내기
<button onClick={handleBulkExport}>
  선택한 {selectedCount}개 대화 내보내기
</button>
```

#### 개별 메시지 복사

```typescript
// 각 메시지 버블에 복사 버튼
<button
  className="msg-copy-btn"
  onClick={() => navigator.clipboard.writeText(msg.content)}
  title="메시지 복사"
>
  📋
</button>
```

---

## 구현 완료 요약

| Feature | 상태 | 버전 | 신규 파일 | 수정 파일 |
|---------|------|------|----------|----------|
| 웹 검색 | ✅ 완료 | v2, v3.1 | 2 | 4 |
| 사이드바 컨텍스트 | ✅ 완료 | v3.0 | 1 | 3 |
| 에이전트 모드 | ✅ 완료 | v2, v3.6 | 2 | 3 |
| 스마트 북마크 | ✅ 완료 | v2 | 2 | 3 |
| 키보드 단축키 | ⚠️ 부분 | v3.3 | 1 | 2 |
| 대화 내보내기 | ✅ 완료 | v3.0, v3.5 | 2 | 2 |

### 총 변경 범위 (실제)

- 신규 파일: 10개
- 수정 파일: 17개
- 새 Storage 키: 15개
- 새 탭: 2개 (북마크, 토론)
- manifest.json: permissions 확장, content_scripts 추가

---

## 향후 작업 (v5.0 예정)

- [ ] 키보드 단축키 완전 구현 (커스터마이징 + Chrome commands)
- [ ] 비서 마켓플레이스 (공유/검색/추천)
- [ ] PPT 기획 도구
- [ ] AI 가드레일 (개인정보 마스킹)
