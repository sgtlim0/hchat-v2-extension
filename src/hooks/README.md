# src/hooks/

## 개요

사이드패널과 팝업에서 사용하는 React 커스텀 훅 5개. 채팅 상태 관리, 설정 관리 (5개 프로바이더), 프로바이더 관리, 네트워크 감지, 키보드 단축키 처리를 담당한다.

## 파일 목록

| 파일 | 줄 수 | 설명 |
|------|-------|------|
| `useChat.ts` | 489 | 채팅 상태 관리 — 메시지 전송/수신, 에이전트 모드, 웹 검색, 스트리밍, PII 감지, 템플릿, 추적/요약, 음성, 체인 [v6.0] |
| `useConfig.ts` | ~95 | 설정 관리 — 5개 프로바이더 (aws/openai/gemini/ollama/openrouter), deep-merge [v6.0] |
| `useProvider.ts` | ~45 | 프로바이더 관리 — 메모이제이션된 인스턴스, 모델 리스트, 자동 라우팅 [v6.0 5개 프로바이더] |
| `useNetworkStatus.ts` | ~30 | 네트워크 상태 — navigator.onLine + online/offline 이벤트 |
| `useShortcuts.ts` | ~40 | 키보드 단축키 바인딩 (7 actions) |

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
| `assistantId` | `string \| null` | 현재 활성 비서 ID [v5.0+] |
| `setAssistantId` | `function` | 비서 변경 [v5.0+] |
| `error` | `string` | 에러 메시지 |
| `currentModel` | `string` | 현재 선택된 모델 |
| `setCurrentModel` | `function` | 모델 변경 |
| `piiDetections` | `PIIDetection[]` | 감지된 PII 목록 [v5.0+] |
| `confirmSendWithPII` | `function` | PII 포함 메시지 전송 확인 [v5.0+] |
| `sendMessage` | `function` | 메시지 전송 (이미지/시스템 프롬프트 옵션) |
| `startNew` | `function` | 새 대화 시작 |
| `loadConv` | `function` | 기존 대화 불러오기 |
| `stop` | `function` | 응답 생성 중지 (AbortController) |
| `editAndResend` | `function` | 사용자 메시지 편집 후 재전송 |
| `regenerate` | `function` | 마지막 AI 응답 재생성 |
| `runTemplate` | `function` | 채팅 템플릿 실행 (변수 치환) [v5.0+] |

### 메시지 전송 플로우

```
1. PII 감지: guardrail.detectPII() 실행 [v5.0+]
   → 감지되면 piiDetections 설정 후 중단 (confirmSendWithPII 대기)
2. 대화 없으면 startNew() 호출
3. 사용자 메시지 DB 저장 및 화면 추가
4. AI 응답 플레이스홀더 생성 (streaming: true)
5. 비서 활성화 시 시스템 프롬프트 주입 [v5.0+]
6. 모드 분기:
   ┌─ 에이전트 모드:
   │  → runAgent() (최대 10단계, BUILTIN_TOOLS + custom plugins)
   │  → onStep() 콜백으로 단계별 UI 업데이트
   │  → thinking → tool_call → tool_result → response
   └─ 일반 모드:
      → needsWebSearch() 의도 감지
      → 검색 필요 시 webSearch() → RAG 시스템 프롬프트 주입
      → provider.stream() (최근 20개 메시지)
      → onChunk()로 실시간 텍스트 업데이트
7. 사용 패턴 추적: trackUsage() [v5.3+]
8. 자동 요약: 20+ 메시지 시 summarizeConversation() [v5.3+]
9. 완료: streaming: false, DB 저장, Usage.track()
```

### sendMessage 옵션

```typescript
opts?: {
  imageBase64?: string       // 첨부 이미지 (Base64 data URL)
  systemPrompt?: string      // 커스텀 시스템 프롬프트 (페이지 컨텍스트)
  forcedModel?: string       // 모델 강제 지정
  bypassPII?: boolean        // PII 검사 우회 (confirmSendWithPII에서 사용) [v5.0+]
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

## useConfig.ts [v3 강화]

확장 설정을 `chrome.storage.local`에서 로드하고 업데이트하는 훅. 다중 프로바이더 지원.

### 주요 타입

```typescript
export interface AwsCredentials {
  accessKeyId: string
  secretAccessKey: string
  region: string              // 기본값: 'us-east-1'
}

export interface OpenAICredentials {
  apiKey: string
}

export interface GeminiCredentials {
  apiKey: string
}

export interface Config {
  aws?: AwsCredentials
  openai?: OpenAICredentials
  gemini?: GeminiCredentials
  defaultModel: string        // 모든 프로바이더 모델 ID
  autoRouting: boolean        // 자동 모델 라우팅 활성화 [v3 신규]
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
| `hasAwsKey()` | AWS 자격증명 설정 여부 |
| `hasOpenAIKey()` | OpenAI API 키 설정 여부 [v3 신규] |
| `hasGeminiKey()` | Gemini API 키 설정 여부 [v3 신규] |
| `hasAnyKey()` | 최소 1개 프로바이더 설정 여부 [v3 신규] |

### 설정 저장 구조

- `hchat:config` — 전체 설정 객체
- `hchat:config:aws` — AWS 자격증명 (백그라운드 서비스 워커 접근용)
- `hchat:config:openai` — OpenAI 자격증명
- `hchat:config:gemini` — Gemini 자격증명

---

## useProvider.ts [v3 신규]

프로바이더 인스턴스 생성 및 관리, 모델 라우팅을 담당하는 훅.

### 반환값

```typescript
interface UseProviderReturn {
  providers: Map<string, AIProvider>  // modelId → provider 맵
  allModels: ModelDef[]               // 사용 가능한 모든 모델
  getProvider: (modelId: string) => AIProvider | undefined
  routeModel: (prompt: string) => string  // 프롬프트 기반 자동 라우팅
}
```

### 주요 기능

1. **프로바이더 인스턴스 생성**
   - Config 기반으로 활성 프로바이더만 생성
   - useMemo로 메모이제이션 (자격증명 변경 시에만 재생성)

2. **모델 탐색**
   - `getAllModels()` 호출로 모든 프로바이더의 모델 수집
   - 프로바이더별 색상, 아이콘 메타데이터 포함

3. **자동 라우팅**
   - `config.autoRouting` 활성화 시 `routeModel()` 사용
   - 프롬프트 패턴 분석 (코드/추론/속도) → 최적 모델 선택
   - 비활성화 시 `config.defaultModel` 반환

### 사용 예시

```typescript
const { providers, allModels, getProvider, routeModel } = useProvider(config)

// 특정 모델 프로바이더 가져오기
const provider = getProvider('gpt-4o')

// 자동 라우팅
const modelId = routeModel('다음 파이썬 코드를 최적화해줘')

// 스트리밍
for await (const chunk of provider.stream({ prompt, modelId, ... })) {
  console.log(chunk)
}
```

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
├── lib/providers       (provider.stream, getProviderForModel) [v3+]
├── lib/chatHistory     (CRUD, ChatMessage, Conversation)
├── lib/searchIntent    (needsWebSearch, extractSearchQuery)
├── lib/webSearch       (webSearch, buildSearchContext)
├── lib/agent           (runAgent, AgentStep)
├── lib/agentTools      (BUILTIN_TOOLS)
├── lib/pluginRegistry  (custom tools) [v3.6+]
├── lib/assistantBuilder (getAssistantById, systemPrompt) [v5.0+]
├── lib/guardrail       (detectPII, PIIDetection) [v5.0+]
├── lib/chatTemplates   (extractVariables, replaceVariables) [v5.0+]
├── lib/userPreferences (trackUsage) [v5.3+]
├── lib/conversationSummarizer (summarizeConversation) [v5.3+]
├── lib/intentRouter    (detectIntent, recommendAssistant, recommendTool) [v5.3+]
├── lib/messageQueue    (enqueueMessage, processQueue) [v3.6+]
└── lib/usage           (Usage.track)

useConfig
└── lib/storage         (chrome.storage.local 래퍼)

useProvider
├── lib/providers       (createAllProviders, getAllModels, model-router) [v3+]
└── useConfig

useShortcuts
└── lib/shortcuts       (loadShortcuts, matchShortcut, Shortcut, ShortcutAction)
```

## 상태 관리 전략

| 훅 | 전략 | 특징 |
|----|------|------|
| `useChat` | Optimistic + Persistent | 메시지 즉시 화면 추가 → DB 저장 → 실패 시 에러 표시 |
| `useConfig` | Eager Loading + Deep Merge | 초기 전체 로드, 부분 업데이트 시 기존값과 병합 |
| `useShortcuts` | Event-driven + Context-aware | keydown 리스너, 입력 필드 상황에 따라 분기 |
