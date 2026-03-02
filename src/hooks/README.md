# src/hooks/

## 개요

사이드패널과 팝업에서 사용하는 React 커스텀 훅 3개. 채팅 상태 관리, 설정 관리, 키보드 단축키 처리를 담당한다.

## 파일 목록

| 파일 | 줄 수 | 설명 |
|------|-------|------|
| `useChat.ts` | 256 | 채팅 상태 관리 — 메시지 전송/수신, 에이전트 모드, 웹 검색, 스트리밍 |
| `useConfig.ts` | 62 | 설정 관리 — AWS 자격증명, 기본 모델, 기능 토글 |
| `useShortcuts.ts` | 40 | 키보드 단축키 바인딩 |

## useChat.ts

채팅의 전체 라이프사이클을 관리하는 핵심 훅.

### 시그니처

```typescript
function useChat(config: Config): UseChatReturn
```

### 반환값

| 필드 | 타입 | 설명 |
|------|------|------|
| `conv` | `Conversation \| null` | 현재 대화 |
| `messages` | `ChatMessage[]` | 메시지 배열 (스트리밍 상태 포함) |
| `isLoading` | `boolean` | 응답 생성 중 |
| `isSearching` | `boolean` | 웹 검색 중 |
| `agentMode` | `boolean` | 에이전트 모드 활성화 여부 |
| `setAgentMode` | `function` | 에이전트 모드 토글 |
| `personaId` | `string` | 현재 페르소나 ID |
| `setPersonaId` | `function` | 페르소나 변경 |
| `error` | `string` | 에러 메시지 |
| `currentModel` | `string` | 현재 선택된 모델 |
| `setCurrentModel` | `function` | 모델 변경 |
| `sendMessage` | `function` | 메시지 전송 (이미지/시스템 프롬프트 옵션) |
| `startNew` | `function` | 새 대화 시작 |
| `loadConv` | `function` | 기존 대화 불러오기 |
| `stop` | `function` | 응답 생성 중지 (AbortController) |
| `editAndResend` | `function` | 사용자 메시지 편집 후 재전송 |
| `regenerate` | `function` | 마지막 AI 응답 재생성 |

### 메시지 전송 플로우

```
1. 대화 없으면 startNew() 호출
2. 사용자 메시지 DB 저장 및 화면 추가
3. AI 응답 플레이스홀더 생성 (streaming: true)
4. 모드 분기:
   ┌─ 에이전트 모드:
   │  → runAgent() (최대 10단계, BUILTIN_TOOLS)
   │  → onStep() 콜백으로 단계별 UI 업데이트
   │  → thinking → tool_call → tool_result → response
   └─ 일반 모드:
      → needsWebSearch() 의도 감지
      → 검색 필요 시 webSearch() → RAG 시스템 프롬프트 주입
      → streamChatLive() (최근 20개 메시지)
      → onChunk()로 실시간 텍스트 업데이트
5. 완료: streaming: false, DB 저장, Usage.track()
```

### sendMessage 옵션

```typescript
opts?: {
  imageBase64?: string       // 첨부 이미지 (Base64 data URL)
  systemPrompt?: string      // 커스텀 시스템 프롬프트 (페이지 컨텍스트)
  forcedModel?: string       // 모델 강제 지정
}
```

### 웹 검색 통합

```typescript
if (config.enableWebSearch && needsWebSearch(text)) {
  const query = extractSearchQuery(text)
  const results = await webSearch({ query, maxResults: 5, ... })
  systemPrompt = buildSearchContext(results) + '\n\n' + systemPrompt
  searchSources = results.map(r => ({ title: r.title, url: r.url }))
}
```

---

## useConfig.ts

확장 설정을 `chrome.storage.local`에서 로드하고 업데이트하는 훅.

### 주요 타입

```typescript
export interface AwsCredentials {
  accessKeyId: string
  secretAccessKey: string
  region: string              // 기본값: 'us-east-1'
}

export interface Config {
  aws: AwsCredentials
  defaultModel: string        // 기본값: 'us.anthropic.claude-sonnet-4-6'
  theme: 'dark' | 'light'
  language: string            // 기본값: 'ko'
  enableContentScript: boolean  // 텍스트 선택 도구
  enableSearchEnhance: boolean  // 검색 엔진 강화
  enableWebSearch: boolean      // 웹 검색 (RAG)
  googleSearchApiKey: string    // Google CSE API Key (선택)
  googleSearchEngineId: string  // CSE Engine ID (선택)
}
```

### 반환값

| 필드 | 설명 |
|------|------|
| `config` | 현재 설정 객체 |
| `update(patch)` | 부분 업데이트 → 즉시 상태 변경 → Storage 저장 → `CONFIG_UPDATED` 전송 |
| `loaded` | 스토리지에서 로드 완료 여부 |
| `hasAwsKey()` | AWS 자격증명 설정 여부 확인 |

### 설정 저장 구조

- `hchat:config` — 전체 설정 객체
- `hchat:config:aws` — AWS 자격증명 (백그라운드 서비스 워커 접근용)

---

## useShortcuts.ts

키보드 단축키를 `keydown` 이벤트에 바인딩하는 훅.

### 시그니처

```typescript
function useShortcuts(
  actions: Partial<Record<ShortcutAction, () => void>>
): Shortcut[]
```

### 동작 규칙

| 상황 | 처리 |
|------|------|
| 입력 필드 + 단일 키 (`/`) | **무시** (텍스트 입력 우선) |
| 입력 필드 + 조합 키 (`Ctrl+K`) | **동작** (단축키 우선) |
| 입력 필드 + `Escape` | `stop-generation`만 **동작** |
| 비입력 영역 | 모든 단축키 **동작** |

### 사용 예시

```typescript
const shortcutActions = useMemo(() => ({
  'new-chat': () => { setTab('chat'); chatNewRef.current?.() },
  'focus-input': () => { setTab('chat'); chatInputRef.current?.() },
  'stop-generation': () => chatStopRef.current?.(),
  'search-history': () => setShowSearch(true),
  'toggle-context': () => setContextEnabled((v) => !v),
  'next-tab': () => cycleTab(1),
  'prev-tab': () => cycleTab(-1),
}), [cycleTab])

useShortcuts(shortcutActions)
```

## 의존성 맵

```
useChat
├── lib/models          (streamChatLive, MODELS)
├── lib/chatHistory     (CRUD, ChatMessage, Conversation)
├── lib/searchIntent    (needsWebSearch, extractSearchQuery)
├── lib/webSearch       (webSearch, buildSearchContext)
├── lib/agent           (runAgent, AgentStep)
├── lib/agentTools      (BUILTIN_TOOLS)
├── lib/personas        (Personas — 시스템 프롬프트)
└── lib/usage           (Usage.track)

useConfig
└── lib/storage         (chrome.storage.local 래퍼)

useShortcuts
└── lib/shortcuts       (loadShortcuts, matchShortcut, Shortcut, ShortcutAction)
```

## 상태 관리 전략

| 훅 | 전략 | 특징 |
|----|------|------|
| `useChat` | Optimistic + Persistent | 메시지 즉시 화면 추가 → DB 저장 → 실패 시 에러 표시 |
| `useConfig` | Eager Loading + Deep Merge | 초기 전체 로드, 부분 업데이트 시 기존값과 병합 |
| `useShortcuts` | Event-driven + Context-aware | keydown 리스너, 입력 필드 상황에 따라 분기 |
