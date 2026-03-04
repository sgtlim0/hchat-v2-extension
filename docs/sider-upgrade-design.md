# H Chat v2 → v3 기능 확장 설계안

## Sider 분석 기반 업그레이드 로드맵

**문서 버전**: 1.0
**작성일**: 2026-03-02
**마지막 업데이트**: 2026-03-05
**대상**: hchat-v2-extension
**현재 버전**: v5.0
**참고**: 이 문서는 v2→v3 전환 계획서입니다. 대부분 기능이 v3.x~v5.0에서 구현 완료되었습니다.

---

## 1. 현재 상태 (v2) vs 목표 (v3)

### v2 이미 구현된 기능

| 기능 | 구현 수준 | 파일 |
|------|-----------|------|
| AI 채팅 (Claude 전용) | ✅ 완성 | `lib/models.ts`, `hooks/useChat.ts` |
| 그룹 채팅 (Claude 모델 비교) | ✅ 완성 | `components/GroupChatView.tsx` |
| 페이지 요약 | ✅ 완성 | `lib/pageReader.ts`, `lib/summarize.ts` |
| YouTube 자막 요약 | ✅ 완성 | `lib/pageReader.ts` (3단계 fallback) |
| 텍스트 선택 플로팅 툴바 | ✅ 완성 | `content/toolbar.ts` (7개 액션) |
| 웹 검색 + RAG | ✅ 완성 | `lib/webSearch.ts`, `lib/searchIntent.ts` |
| 멀티턴 에이전트 | ✅ 완성 | `lib/agent.ts` (5개 도구, 최대 10스텝) |
| 글쓰기 도구 | ✅ 완성 | `lib/writingTools.ts` (11가지 변환) |
| 스마트 북마크/하이라이트 | ✅ 완성 | `lib/bookmarks.ts` |
| 프롬프트 라이브러리 | ✅ 완성 | `lib/promptLibrary.ts` |
| 내보내기/가져오기 | ✅ 완성 | `lib/exportChat.ts`, `lib/importChat.ts` |
| 사용량 추적 | ✅ 완성 | `lib/usage.ts` |
| TTS/STT | ✅ 완성 | `lib/tts.ts`, `lib/stt.ts` |
| OCR | ✅ 완성 | `components/ToolsView.tsx` (Vision) |

### v3에서 추가할 기능 (Sider 분석 기반)

| 기능 | 우선순위 | 복잡도 | Phase |
|------|----------|--------|-------|
| **멀티 AI 프로바이더** (OpenAI, Gemini) | 🔴 최우선 | 높음 | 1 |
| **자동 모델 라우팅** | 🔴 최우선 | 중간 | 1 |
| **검색엔진 AI 카드 삽입** | 🟡 높음 | 중간 | 2 |
| **YouTube 타임스탬프 추출** | 🟡 높음 | 중간 | 2 |
| **YouTube 댓글 분석** | 🟢 중간 | 중간 | 3 |
| **PDF 업로드 + 채팅** | 🟢 중간 | 높음 | 3 |
| **Cross-Model Debate** | 🟢 중간 | 높음 | 3 |
| **입력창 AI 글쓰기 지원** | 🟡 높음 | 중간 | 2 |
| **인라인 스트리밍** (카드 내부) | 🟡 높음 | 높음 | 2 |
| **통합 인사이트 리포트** | 🟢 중간 | 높음 | 4 |

---

## 2. Phase 1: 멀티 AI 프로바이더 + 자동 라우팅

### 2.1 AI Provider 추상화 레이어

**목표**: Claude 전용 → OpenAI GPT + Google Gemini + AWS Bedrock Claude 통합

#### 새 파일 구조

```
src/lib/providers/
├── types.ts              # 공통 인터페이스
├── bedrock-provider.ts   # 기존 models.ts 리팩토링
├── openai-provider.ts    # OpenAI API 직접 호출
├── gemini-provider.ts    # Google Gemini API
├── provider-factory.ts   # 프로바이더 생성/관리
└── model-router.ts       # 자동 모델 선택
```

#### 핵심 인터페이스

```typescript
// src/lib/providers/types.ts

export type ProviderType = 'bedrock' | 'openai' | 'gemini'

export interface AIProvider {
  type: ProviderType
  name: string

  /** 일반 요청 (전체 응답) */
  send(params: SendParams): Promise<string>

  /** 스트리밍 요청 */
  stream(params: SendParams): AsyncGenerator<string, void, unknown>

  /** 연결 테스트 */
  test(): Promise<boolean>
}

export interface SendParams {
  messages: Message[]
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
}

export interface ModelDef {
  id: string
  provider: ProviderType
  label: string
  shortLabel: string
  capabilities: ModelCapability[]
  costPer1kInput: number   // USD
  costPer1kOutput: number  // USD
}

export type ModelCapability =
  | 'reasoning'     // 복잡한 추론
  | 'coding'        // 코드 생성
  | 'vision'        // 이미지 분석
  | 'multilingual'  // 다국어
  | 'fast'          // 빠른 응답
  | 'creative'      // 창작
```

#### 프로바이더 팩토리

```typescript
// src/lib/providers/provider-factory.ts

export function createProvider(
  type: ProviderType,
  credentials: ProviderCredentials
): AIProvider {
  switch (type) {
    case 'bedrock':
      return new BedrockProvider(credentials.aws)
    case 'openai':
      return new OpenAIProvider(credentials.openai)
    case 'gemini':
      return new GeminiProvider(credentials.gemini)
  }
}
```

#### 자동 모델 라우팅

```typescript
// src/lib/providers/model-router.ts

export function routeModel(
  prompt: string,
  context: RoutingContext
): ModelDef {
  const analysis = analyzePrompt(prompt)

  // 코드 관련 → GPT 우선
  if (analysis.hasCode) return findBestModel('coding')

  // 긴 추론 → Claude 우선
  if (analysis.length > 500 || analysis.isComplex)
    return findBestModel('reasoning')

  // 이미지 포함 → Vision 지원 모델
  if (context.hasImages) return findBestModel('vision')

  // 빠른 응답 필요 → Haiku
  if (context.preferSpeed) return findBestModel('fast')

  // 기본값
  return context.defaultModel
}

function analyzePrompt(prompt: string): PromptAnalysis {
  return {
    hasCode: /```|function|class |import |const |let /.test(prompt),
    isComplex: prompt.length > 500 || /분석|비교|설명|why|how/.test(prompt),
    length: prompt.length,
    language: detectLanguage(prompt),
  }
}
```

### 2.2 설정 UI 변경

```
SettingsView → API Keys 섹션 확장:

┌─────────────────────────────┐
│ AWS Bedrock (Claude)        │
│ [Access Key] [Secret Key]   │
│ [Region]       [테스트]      │
├─────────────────────────────┤
│ OpenAI (GPT)                │
│ [API Key]      [테스트]      │
├─────────────────────────────┤
│ Google (Gemini)             │
│ [API Key]      [테스트]      │
├─────────────────────────────┤
│ 자동 모델 선택  [토글]       │
│ 기본 모델      [드롭다운]    │
└─────────────────────────────┘
```

### 2.3 Config 타입 확장

```typescript
// hooks/useConfig.ts 확장

export interface Config {
  // 기존 AWS
  aws: {
    accessKeyId: string
    secretAccessKey: string
    region: string
  }
  // 신규
  openai: {
    apiKey: string
  }
  gemini: {
    apiKey: string
  }
  // 모델 설정
  defaultModel: string
  autoRouting: boolean
  // 기존 유지
  webSearchEnabled: boolean
  googleSearchApiKey: string
  googleSearchEngineId: string
  theme: 'dark' | 'light'
  language: string
}
```

### 2.4 그룹 채팅 확장

현재: Claude 모델 간 비교 (Sonnet vs Opus vs Haiku)
변경: **프로바이더 간 비교** (Claude vs GPT vs Gemini)

```typescript
// GroupChatView 변경

// 기존: 같은 프로바이더의 다른 모델
const MODELS = [sonnet, opus, haiku]

// 변경: 다른 프로바이더의 대표 모델
const MODELS = [
  { id: 'claude-sonnet', provider: 'bedrock' },
  { id: 'gpt-4o-mini', provider: 'openai' },
  { id: 'gemini-2.0-flash', provider: 'gemini' },
]
```

---

## 3. Phase 2: 브라우저 통합 강화

### 3.1 검색엔진 AI 카드 삽입

**목표**: Google/Bing 검색 결과 페이지 상단에 AI 요약 카드 자동 삽입

#### 구현 구조

```
src/content/
├── index.ts              # 기존 (페이지 컨텍스트)
├── toolbar.ts            # 기존 (플로팅 툴바)
├── search-injector.ts    # 신규: 검색엔진 AI 카드
└── writing-assistant.ts  # 신규: 입력창 AI 지원
```

#### search-injector.ts 설계

```typescript
// 지원 검색엔진
const SEARCH_ENGINES = {
  google: {
    pattern: /google\.com\/search/,
    queryParam: 'q',
    insertTarget: '#search',
    insertPosition: 'prepend',
  },
  bing: {
    pattern: /bing\.com\/search/,
    queryParam: 'q',
    insertTarget: '#b_results',
    insertPosition: 'prepend',
  },
  naver: {
    pattern: /search\.naver\.com/,
    queryParam: 'query',
    insertTarget: '#main_pack',
    insertPosition: 'prepend',
  },
}

// 동작 흐름:
// 1. URL 패턴 감지
// 2. 검색어 추출
// 3. AI 카드 DOM 삽입
// 4. Background에 스트리밍 요청
// 5. 카드 내부에 인라인 스트리밍
```

#### AI 카드 UI

```
┌─────────────────────────────────────┐
│ 🤖 AI 요약                    ⏹ ✕ │
├─────────────────────────────────────┤
│ [스트리밍 텍스트...]                │
│                                     │
│ 📊 모델: Sonnet 4.6 · 342 토큰     │
│ ⏱ 1.2초                           │
└─────────────────────────────────────┘
```

#### manifest.json 변경

```json
{
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/index.js"],
      "run_at": "document_idle"
    },
    {
      "matches": [
        "https://www.google.com/search*",
        "https://www.bing.com/search*",
        "https://search.naver.com/*"
      ],
      "js": ["content/search-injector.js"],
      "run_at": "document_idle"
    }
  ]
}
```

### 3.2 YouTube 타임스탬프 추출

**목표**: 자막 기반 핵심 구간 자동 분할 + 클릭 시 해당 시점 이동

#### 기존 pageReader.ts 확장

```typescript
// 기존: 자막 텍스트만 반환
export async function getYouTubeTranscript(videoId: string): Promise<string>

// 추가: 구조화된 자막 (타임스탬프 포함)
export interface TranscriptSegment {
  start: number   // 초
  text: string
}

export async function getYouTubeTranscriptStructured(
  videoId: string
): Promise<TranscriptSegment[]> {
  // XML에서 <text start="12.34">내용</text> 파싱
  // TranscriptSegment[] 반환
}
```

#### 타임스탬프 생성 프롬프트

```typescript
export function buildTimestampPrompt(segments: TranscriptSegment[]): string {
  const transcript = segments
    .map(s => `[${formatTime(s.start)}] ${s.text}`)
    .join('\n')

  return `다음 YouTube 자막을 분석하여 5-10개의 핵심 챕터를 생성해주세요.

각 챕터:
- 시작 시간 (초)
- 짧은 제목 (최대 8단어)
- 한 줄 설명

JSON 배열로 반환:
[{"time": 123, "title": "...", "summary": "..."}]

자막:
${transcript}`
}
```

#### ToolsView에 YouTube 탭 확장

```
기존: [요약] 버튼만
변경:
┌─────────────────────┐
│ ▶️ YouTube 도구      │
├─────────────────────┤
│ [요약]  [타임스탬프]  │
│ [댓글 분석]          │
├─────────────────────┤
│ 결과 영역            │
│ 00:00 - 인트로       │
│ 02:34 - 핵심 개념    │  ← 클릭 시 이동
│ 05:12 - 실습 예제    │
└─────────────────────┘
```

### 3.3 입력창 AI 글쓰기 지원

**목표**: 모든 웹페이지의 textarea/input에서 AI 글쓰기 지원

#### writing-assistant.ts 설계

```typescript
// 감지 대상
const INPUT_SELECTORS = [
  'textarea',
  '[contenteditable="true"]',
  '[role="textbox"]',
  'input[type="text"]',
]

// 동작:
// 1. MutationObserver로 입력창 감지
// 2. 입력창 옆에 작은 ✨ 버튼 삽입
// 3. 클릭 시 글쓰기 도구 팝업
//    - 개선 (Improve)
//    - 축약 (Shorter)
//    - 확장 (Longer)
//    - 전문적 (Professional)
//    - 캐주얼 (Casual)
//    - 번역 (Translate)
//    - 문법 교정 (Grammar)
// 4. 선택 시 현재 입력 내용을 AI로 변환
// 5. 결과를 입력창에 자동 삽입
```

### 3.4 인라인 스트리밍

**목표**: 사이드패널 없이 웹페이지 내부에서 직접 AI 응답 스트리밍

현재 toolbar.ts가 이미 Port 기반 스트리밍을 구현하고 있으므로,
동일한 패턴을 search-injector와 YouTube 카드에 적용.

```typescript
// 공통 스트리밍 유틸
function createInlineStream(
  containerId: string,
  prompt: string,
  model?: string
) {
  const port = chrome.runtime.connect({ name: 'inline-stream' })

  port.postMessage({ type: 'STREAM_REQUEST', prompt, model })

  port.onMessage.addListener((msg) => {
    const el = document.getElementById(containerId)
    if (!el) return

    if (msg.type === 'chunk') {
      el.textContent += msg.text
    } else if (msg.type === 'done') {
      // 완료 표시
    } else if (msg.type === 'error') {
      el.textContent = `오류: ${msg.error}`
    }
  })

  return () => port.disconnect() // 중단 함수 반환
}
```

---

## 4. Phase 3: 고급 기능

### 4.1 YouTube 댓글 분석

```typescript
// src/lib/commentAnalyzer.ts

export interface CommentAnalysis {
  sentiment: {
    positive: number  // 퍼센트
    neutral: number
    negative: number
  }
  topThemes: Array<{
    name: string
    count: number
  }>
  audienceInsights: string[]
  controversialTopics: string[]
}

// 댓글 수집: content script에서 DOM 파싱
// #content-text 셀렉터로 댓글 텍스트 추출
// 최대 200개 수집 후 AI 분석
```

### 4.2 PDF 업로드 + 채팅

```typescript
// src/lib/pdfParser.ts

export async function extractPdfText(file: File): Promise<string> {
  // PDF.js 사용 (cdn 또는 번들)
  // 텍스트 레이어 추출
  // 최대 50,000자 제한
}

// 사이드패널 ToolsView에 PDF 탭 추가
// 1. 파일 업로드 UI
// 2. 텍스트 추출 + 청킹
// 3. 질문-응답 모드 (RAG 패턴)
//    - 사용자 질문 → 관련 청크 검색 → 컨텍스트 주입 → AI 응답
```

### 4.3 Cross-Model Debate

그룹 채팅의 고급 모드. 단순 병렬 비교가 아닌 **토론 구조**:

```
Round 1: 모든 모델이 독립적으로 답변
Round 2: 각 모델이 다른 모델의 답변을 비평
Round 3: 종합 모델이 최종 정리

예:
1. GPT: "A가 최선입니다. 이유는..."
2. Claude: "GPT의 답변에서 X는 맞지만 Y는 고려하지 않았습니다..."
3. Gemini (종합): "두 관점을 종합하면..."
```

```typescript
// src/lib/debate.ts

export interface DebateRound {
  modelId: string
  role: 'initial' | 'critique' | 'synthesis'
  content: string
}

export async function runDebate(
  prompt: string,
  models: ModelDef[],
  rounds: number = 3
): AsyncGenerator<DebateRound> {
  // Round 1: 병렬 초기 답변
  // Round 2: 순차 비평 (이전 답변을 컨텍스트로)
  // Round 3: 종합 정리
}
```

---

## 5. Phase 4: 프로 기능

### 5.1 통합 인사이트 리포트

YouTube 영상 + 댓글을 종합한 PDF/Markdown 리포트 자동 생성:

```
리포트 구조:
1. 영상 개요 (TL;DR + 핵심 포인트)
2. 타임스탬프 챕터
3. 댓글 감정 분석 (긍정/중립/부정 비율)
4. 반복 주제
5. 시청자 인사이트
6. 논쟁 포인트
```

기존 `exportChat.ts`의 패턴을 확장하여 구현.

### 5.2 비용 추적 대시보드 확장

현재 `usage.ts`가 토큰/비용을 추적하지만, 멀티 프로바이더 지원 시:

```typescript
export interface UsageRecord {
  timestamp: number
  provider: ProviderType
  model: string
  inputTokens: number
  outputTokens: number
  cost: number          // USD
  feature: 'chat' | 'group' | 'tool' | 'search' | 'agent'
}

// 프로바이더별, 기능별 비용 분석
// 일별/월별 차트
// 예산 알림 설정
```

---

## 6. 기술 설계 상세

### 6.1 새로운 파일 구조

```
src/
├── lib/
│   ├── providers/           # 신규: 멀티 AI 프로바이더
│   │   ├── types.ts
│   │   ├── bedrock-provider.ts
│   │   ├── openai-provider.ts
│   │   ├── gemini-provider.ts
│   │   ├── provider-factory.ts
│   │   └── model-router.ts
│   │
│   ├── commentAnalyzer.ts   # 신규: YouTube 댓글 분석
│   ├── pdfParser.ts         # 신규: PDF 텍스트 추출
│   ├── debate.ts            # 신규: Cross-Model Debate
│   ├── insightReport.ts     # 신규: 통합 리포트 생성
│   │
│   ├── models.ts            # 리팩토링: providers/ 사용
│   ├── pageReader.ts        # 확장: 구조화된 자막
│   └── (기존 파일 유지)
│
├── content/
│   ├── index.ts             # 기존 유지
│   ├── toolbar.ts           # 기존 유지
│   ├── search-injector.ts   # 신규: 검색엔진 AI 카드
│   └── writing-assistant.ts # 신규: 입력창 AI 지원
│
├── components/
│   ├── ChatView.tsx         # 확장: 자동 라우팅 표시
│   ├── GroupChatView.tsx    # 확장: 프로바이더 간 비교
│   ├── ToolsView.tsx        # 확장: YouTube 타임스탬프, PDF
│   ├── SettingsView.tsx     # 확장: 멀티 프로바이더 키 관리
│   ├── DebateView.tsx       # 신규: 토론 모드
│   └── (기존 파일 유지)
│
└── hooks/
    ├── useConfig.ts         # 확장: 멀티 프로바이더 설정
    ├── useProvider.ts       # 신규: 프로바이더 관리 훅
    └── (기존 파일 유지)
```

### 6.2 의존성 추가

```json
{
  "dependencies": {
    "pdfjs-dist": "^4.0.0"      // PDF 텍스트 추출 (Phase 3)
  }
}
```

> OpenAI, Gemini API는 `fetch`로 직접 호출 (SDK 불필요)
> Chart.js는 content script에서 CDN 로드 (번들 크기 절감)

### 6.3 manifest.json 변경사항

```json
{
  "host_permissions": [
    "https://bedrock-runtime.*.amazonaws.com/*",
    "https://api.openai.com/*",           // 신규
    "https://generativelanguage.googleapis.com/*",  // 신규
    "<all_urls>"
  ],
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/index.js", "content/writing-assistant.js"]
    },
    {
      "matches": [
        "https://www.google.com/search*",
        "https://www.bing.com/search*",
        "https://search.naver.com/*"
      ],
      "js": ["content/search-injector.js"]
    }
  ]
}
```

### 6.4 스토리지 스키마 확장

| 키 | 데이터 | Phase |
|----|--------|-------|
| `hchat:config` | Config (멀티 프로바이더 키 포함) | 1 |
| `hchat:config:openai` | OpenAI API 키 | 1 |
| `hchat:config:gemini` | Gemini API 키 | 1 |
| `hchat:routing-stats` | 모델별 사용 통계 (라우팅 개선용) | 1 |
| `hchat:search-inject:enabled` | 검색 AI 카드 활성화 여부 | 2 |
| `hchat:writing-assist:enabled` | 입력창 AI 지원 활성화 여부 | 2 |

---

## 7. 구현 순서 및 예상 일정

### Phase 1: 멀티 AI 프로바이더 (핵심)

```
1-1. providers/types.ts — 공통 인터페이스 정의
1-2. providers/bedrock-provider.ts — 기존 models.ts 리팩토링
1-3. providers/openai-provider.ts — OpenAI API 연동 (스트리밍)
1-4. providers/gemini-provider.ts — Gemini API 연동 (스트리밍)
1-5. providers/provider-factory.ts — 프로바이더 팩토리
1-6. providers/model-router.ts — 자동 모델 선택
1-7. hooks/useProvider.ts — React 훅
1-8. hooks/useConfig.ts — Config 타입 확장
1-9. components/SettingsView.tsx — 멀티 키 관리 UI
1-10. components/ChatView.tsx — 자동 라우팅 UI 표시
1-11. components/GroupChatView.tsx — 프로바이더 간 비교
1-12. components/ModelSelector.tsx — 확장된 모델 드롭다운
```

### Phase 2: 브라우저 통합 강화

```
2-1. content/search-injector.ts — Google/Bing/Naver AI 카드
2-2. content/writing-assistant.ts — 입력창 AI 지원
2-3. lib/pageReader.ts — 구조화된 YouTube 자막
2-4. components/ToolsView.tsx — YouTube 타임스탬프 UI
2-5. background/index.ts — 인라인 스트리밍 Port 핸들러
2-6. manifest.json — content_scripts 매칭 추가
```

### Phase 3: 고급 기능

```
3-1. lib/commentAnalyzer.ts — YouTube 댓글 분석
3-2. lib/pdfParser.ts — PDF 텍스트 추출
3-3. lib/debate.ts — Cross-Model Debate 엔진
3-4. components/ToolsView.tsx — 댓글 분석/PDF 탭
3-5. components/DebateView.tsx — 토론 모드 UI
```

### Phase 4: 프로 기능

```
4-1. lib/insightReport.ts — 통합 인사이트 리포트
4-2. lib/usage.ts — 멀티 프로바이더 비용 추적 확장
4-3. components/UsageView.tsx — 프로바이더별 비용 대시보드
```

---

## 8. 보안 고려사항

| 항목 | 대책 |
|------|------|
| API 키 저장 | `chrome.storage.local` 전용 (동기화 안 함) |
| OpenAI API 키 노출 | 확장 내부에서만 사용, 외부 전송 없음 |
| content script 격리 | 모든 content script는 isolated world |
| 입력창 접근 | 사용자 명시적 클릭 시에만 동작 |
| 댓글 수집 | 로컬 처리, 서버 전송 없음 |
| PDF 처리 | 클라이언트 사이드 전용, 업로드 없음 |

---

## 9. v2 → v3 마이그레이션 전략

1. **기존 코드 보존**: 모든 v2 기능은 그대로 유지
2. **점진적 확장**: 각 Phase별로 독립 배포 가능
3. **하위 호환**: OpenAI/Gemini 키가 없어도 기존 Claude 기능 정상 동작
4. **설정 마이그레이션**: 기존 `hchat:config` 스키마를 자동 변환
5. **기능 토글**: 모든 신규 기능은 설정에서 활성화/비활성화 가능

---

## 10. 경쟁 포지셔닝

| 기능 | Sider | Claude in Chrome | H Chat v3 |
|------|-------|-----------------|-----------|
| 멀티 AI | ✅ | ❌ (Claude만) | ✅ |
| 자동 라우팅 | ❌ | ❌ | ✅ |
| 그룹 비교 | ✅ | ❌ | ✅ |
| 웹 검색 RAG | ✅ | ❌ | ✅ |
| 에이전트 | ❌ | ❌ | ✅ (10스텝) |
| 검색엔진 카드 | ✅ | ❌ | ✅ |
| YouTube 요약 | ✅ | ❌ | ✅ |
| 타임스탬프 | ❌ | ❌ | ✅ |
| 댓글 분석 | ❌ | ❌ | ✅ |
| Cross-Model Debate | ❌ | ❌ | ✅ |
| PDF 채팅 | ✅ | ❌ | ✅ |
| 하이라이트/북마크 | ❌ | ❌ | ✅ |
| 오프라인 (로컬 전용) | ❌ | ❌ | ✅ |
| 비용 추적 | ❌ | ❌ | ✅ |

**핵심 차별화**: 자동 모델 라우팅 + 에이전트 시스템 + Cross-Model Debate + 완전 로컬 (서버 불필요)
