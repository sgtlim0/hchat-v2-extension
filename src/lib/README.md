# src/lib/

## 개요

비즈니스 로직과 유틸리티 함수를 캡슐화하는 라이브러리 모듈. 총 74+ 파일 (v5.7). 멀티 프로바이더 API 통신, 데이터 관리, AI 기능, 검색, 음성, 내보내기/가져오기를 담당한다. 모든 모듈은 `Storage` 래퍼를 통해 `chrome.storage.local`에 접근한다.

## 파일 목록

### 프로바이더 시스템 (v3 신규)

| 파일 | 줄 수 | 설명 |
|------|-------|------|
| `providers/types.ts` | 100+ | AIProvider 인터페이스, ModelDef, ProviderType, StreamOptions, PROVIDER_COLORS 상수 (v5.1) |
| `providers/bedrock-provider.ts` | 200+ | AWS Bedrock Claude 프로바이더 (SigV4 서명, Event Stream 파싱) |
| `providers/openai-provider.ts` | 150+ | OpenAI GPT 프로바이더 (SSE 스트리밍) |
| `providers/gemini-provider.ts` | 150+ | Google Gemini 프로바이더 (SSE 스트리밍) |
| `providers/provider-factory.ts` | 120+ | 프로바이더 생성, 모델 탐색 (createAllProviders, getProviderForModel, getAllModels) |
| `providers/model-router.ts` | 80+ | 자동 모델 라우팅 (프롬프트 패턴 분석) |
| `providers/stream-retry.ts` | 100+ | 스트리밍 에러 복구 (streamWithRetry 자동 재시도 2회) [v3.3] |

### 기존 API 모듈

| 파일 | 줄 수 | 설명 |
|------|-------|------|
| `aws-sigv4.ts` | 94 | AWS Signature V4 서명 (Web Crypto API) |

### AI 기능 모듈

| 파일 | 줄 수 | 설명 |
|------|-------|------|
| `chatHistory.ts` | 204 | 대화 기록 CRUD, 메시지 관리, 분기, 고정 |
| `agent.ts` | 240 | 다중 턴 에이전트 루프 (XML 기반 도구 호출) |
| `agentTools.ts` | 100 | 내장 도구 8종 (web_search, read_page, fetch_url, calculate, get_datetime, translate, summarize_text, timestamp_convert) |
| `commentAnalyzer.ts` | 200+ | YouTube 댓글 추출 및 분석 (감정, 토픽, 인사이트) [v3 신규] |
| `pdfParser.ts` | 150+ | PDF 텍스트 추출 (pdfjs-dist 기반) [v3 신규] |
| `insightReport.ts` | 180+ | YouTube 자막 + 댓글 통합 리포트 생성 [v3 신규] |
| `debate.ts` | 250+ | 크로스 모델 토론 엔진 (3라운드: 초기 → 비평 → 종합), 투표 통합 `runDebateWithVoting()` [v5.6] |
| `debateVoting.ts` | 150+ | 토론 투표 시스템 (1~5점 평가), 스코어보드, 컨센서스 도출 [v5.6 신규] |
| `summarize.ts` | 78 | AI 대화 요약 (최근 30개 메시지) |
| `writingTools.ts` | 60+ | 글쓰기 액션 7종 정의 (프롬프트 템플릿) [v3 업데이트] |
| `batchOcr.ts` | 150+ | 배치 OCR 오케스트레이션 (최대 10장, 4모드: 일반/명함/영수증/스크린샷) [v4.0] |
| `deepResearch.ts` | 180+ | 딥 리서치 오케스트레이션 (쿼리 생성→검색→리포트) [v3.1] |

### 검색 모듈

| 파일 | 줄 수 | 설명 |
|------|-------|------|
| `webSearch.ts` | 131 | DuckDuckGo HTML 스크레이핑 + Google CSE, 1시간 캐시 |
| `searchIntent.ts` | 52 | 규칙 기반 웹 검색 의도 감지 (패턴 매칭) |
| `messageSearch.ts` | 74 | 전체 대화 전문 검색, 스니펫 + 하이라이팅 |

### 데이터 관리 모듈

| 파일 | 줄 수 | 설명 |
|------|-------|------|
| `bookmarks.ts` | 148 | 하이라이트 CRUD, XPath 유틸, 상대 시간 포맷 |
| `tags.ts` | 59 | 대화 태그 CRUD, 자동 색상 할당, 사용 횟수 |
| `storage.ts` | 20 | chrome.storage.local 래퍼 (get/set/remove/getAll) |
| `folders.ts` | 60+ | 대화 폴더 CRUD [v3.1] |
| `storageManager.ts` | 100+ | 스토리지 분석, 고아 데이터 정리 [v3.1] |
| `messageQueue.ts` | 80+ | 오프라인 메시지 큐 (FIFO), 자동 재시도 [v3.6] |
| `detectLanguage.ts` | 40+ | 언어 자동 감지 (한/영/일) |

### 문서 도구 모듈 (v4.1~v4.3)

| 파일 | 줄 수 | 설명 |
|------|-------|------|
| `docTranslator.ts` | 270+ | 문서 번역 파이프라인 (TXT/CSV/XLSX/PPTX/PDF), 청크 분할, 포맷 유지 |
| `docGenerator.ts` | 190+ | AI 문서 생성 (5유형), 목차→본문 파이프라인, DOCX 내보내기 |
| `docProjects.ts` | 200+ | 문서 프로젝트 CRUD + 버전 관리 (최대 10 FIFO) [v4.3 신규] |
| `docTemplateParser.ts` | 220+ | DOCX 템플릿 파싱, `{{필드}}` 추출, fillTemplate [v4.3 신규] |
| `docTemplateGenerator.ts` | 160+ | 템플릿 필드 AI 제안, 섹션별 AI 확장 생성 [v4.3 신규] |
| `pptxParser.ts` | 130+ | PPTX 파싱/재조립 (JSZip + DOMParser, `<a:t>` 노드) [v4.3 신규] |
| `imageGenerator.ts` | 100+ | DALL-E 3 이미지 생성 (3크기, HD/Standard) [v4.2 신규] |
| `docTemplateStore.ts` | 120+ | 템플릿 갤러리 CRUD, Base64, export/import [v4.3] |
| `timeFormat.ts` | 80+ | 시간 포맷팅 (ko/en/ja), ETA 계산 [v4.5] |
| `chartDataExtractor.ts` | 100+ | 차트 데이터 자동 추출 (bar/line) [v3.4] |
| `dataAnalysis.ts` | 150+ | CSV/Excel 파싱 + 분석 프롬프트 [v3.1] |

### 설정/UI 모듈

| 파일 | 줄 수 | 설명 |
|------|-------|------|
| `types.ts` | 50+ | 공통 타입 정의 (PROVIDER_COLORS 상수 등) [v5.1] |
| `shortcuts.ts` | 66 | 키보드 단축키 정의, 파싱, 매칭, 커스터마이징 |
| `promptLibrary.ts` | 67 | 프롬프트 CRUD, 기본 8개, 단축키 검색 |
| `personas.ts` | 124 | 페르소나 관리, 내장 6종 + 커스텀 CRUD |
| `pluginRegistry.ts` | 150+ | 커스텀 플러그인 레지스트리 (Webhook/JS/Prompt), CRUD, 에이전트 모드 통합 [v3.6] |

### 비서 & 추천 모듈 (v5.0~v5.4)

| 파일 | 줄 수 | 설명 |
|------|-------|------|
| `assistantBuilder.ts` | 200+ | 커스텀 비서 CRUD, 20개 내장 비서, 6 카테고리, export/import [v5.0] |
| `guardrail.ts` | 187 | PII 감지/마스킹 (이메일/전화/주민번호/카드/계좌) [v5.0] |
| `chatTemplates.ts` | 170 | 대화 템플릿 CRUD, {{변수}} 치환, max 20 [v5.0] |
| `pptxGenerator.ts` | 292 | PPT 기획 (주제→목차→콘텐츠→PPTX), JSZip OOXML [v5.0] |
| `intentRouter.ts` | 281 | 의도 감지 (9종), 비서/도구 자동 추천 [v5.3] |
| `userPreferences.ts` | 143 | 가중 빈도 추적, 시간 감쇠, top 3 추천 [v5.3] |
| `conversationSummarizer.ts` | 162 | 20+ 메시지 자동 요약, FIFO 캐시 [v5.3] |
| `bm25.ts` | 108 | BM25 스코어링, IDF 계산, 역색인 v2 [v5.3] |

### 멀티모달 & 협업 모듈 (v5.5~v5.6)

| 파일 | 줄 수 | 설명 |
|------|-------|------|
| `voicePipeline.ts` | 200 | 음성 E2E 파이프라인 — STT→AI→TTS 루프, 침묵 감지 [v5.5] |
| `assistantChain.ts` | 284 | 비서 체인 — 순차 파이프라인, {{input}}/{{original}} 치환 [v5.5] |
| `shortcutManager.ts` | 148 | 단축키 매니저 — 포커스 트랩, 키 레코더, 예약 콤보 [v5.5] |

### 고급 기능 모듈 (v5.7)

| 파일 | 줄 수 | 설명 |
|------|-------|------|
| `contextOptimizer.ts` | 120 | 토큰 카운팅 (한글 2자/토큰), 메시지 압축, 컨텍스트 모니터링 [v5.7] |
| `promptCache.ts` | 150 | BM25 유사도 캐시, TTL 24h, FIFO 100 항목, 캐시 통계 [v5.7] |
| `analyticsEngine.ts` | 296 | TF-IDF 토픽 추출, 일별 활동, 시간대 히트맵, 프로바이더 비교 [v5.7] |
| `aiMemory.ts` | 190 | 장기 기억 CRUD, 자동 추출 (이름/선호/프로젝트), 검색, 시스템 프롬프트 주입 [v5.7] |
| `conversationTree.ts` | 190 | 포크 트리 빌드, DFS 탐색, 분기 정보, 대화 병합 [v5.7] |
| `responseTemplate.ts` | 224 | 응답 스타일 4 프리셋, 후처리, 사용 패턴 학습 [v5.7] |
| `multimodalInput.ts` | 190 | 다중 이미지 첨부 (max 5), 유효성 검증, 리사이즈, 스크린샷 캡처 [v5.7] |
| `collaborationMode.ts` | 120 | BroadcastChannel 탭 간 동기화, heartbeat, last-write-wins [v5.7] |
| `workflowBuilder.ts` | 260 | 노드 기반 워크플로우 (4 타입), 조건 분기, 순환 감지, 실행 엔진 [v5.7] |

### 컨텍스트 추출 모듈

| 파일 | 줄 수 | 설명 |
|------|-------|------|
| `pageContext.ts` | 55 | 페이지 유형 감지, 시스템 프롬프트 생성, 컨텍스트 토글 |
| `pageReader.ts` | 137 | 현재 탭 콘텐츠 추출, YouTube 자막 추출 (3단계) |

### 내보내기/가져오기 모듈

| 파일 | 줄 수 | 설명 |
|------|-------|------|
| `exportChat.ts` | 128 | Markdown/HTML/JSON/TXT 내보내기, 클립보드 복사 |
| `importChat.ts` | 188 | ChatGPT/Claude/H Chat JSON 가져오기 |

### 사용량 추적 모듈

| 파일 | 줄 수 | 설명 |
|------|-------|------|
| `usage.ts` | 180+ | 토큰 사용량/비용 추적 (프로바이더별, 기능별), 90일 보관 [v3 강화] |
| `usageAlert.ts` | 120+ | 사용량 알림 + Webhook (Slack/Discord/generic) [v3.5] |

### 음성 모듈

| 파일 | 줄 수 | 설명 |
|------|-------|------|
| `stt.ts` | 114 | Web Speech Recognition API 래퍼 (한국어, 연속 모드) |
| `tts.ts` | 105 | Web Speech Synthesis API 래퍼 (마크다운 정리, 한국어 음성) |

## 주요 인터페이스

### providers/types.ts — 통합 프로바이더 인터페이스 [v3 신규]

```typescript
type ProviderType = 'bedrock' | 'openai' | 'gemini'

interface ModelDef {
  id: string
  provider: ProviderType
  label: string
  shortLabel: string
  emoji: string
  contextWindow: number
  inputCostPer1M: number   // USD per 1M tokens
  outputCostPer1M: number
}

interface StreamOptions {
  prompt: string
  modelId: string
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
}

interface AIProvider {
  type: ProviderType
  models: ModelDef[]
  stream(options: StreamOptions): AsyncGenerator<string, string>
  isConfigured(): boolean
}
```

### providers/bedrock-provider.ts

AWS Bedrock Event Stream 바이너리 프로토콜 직접 파싱:
- `[4B totalLen][4B headersLen][4B preludeCRC][headers...][payload...][4B msgCRC]`
- SigV4 서명 자동 처리

### providers/openai-provider.ts

OpenAI SSE 스트리밍:
- `data: {"choices": [{"delta": {"content": "..."}}]}`
- 표준 Authorization Bearer 헤더

### providers/gemini-provider.ts

Google Gemini SSE 스트리밍:
- JSON Lines 형식
- API Key를 URL 쿼리 파라미터로 전달

### chatHistory.ts — 대화 기록

```typescript
interface ChatMessage {
  id: string; role: 'user' | 'assistant'; content: string;
  model?: string; ts: number; streaming?: boolean; error?: boolean;
  imageUrl?: string; searchSources?: { title: string; url: string }[];
  agentSteps?: AgentStep[]; pinned?: boolean
}

interface Conversation {
  id: string; title: string; model: string; messages: ChatMessage[];
  createdAt: number; updatedAt: number; pinned?: boolean;
  tags?: string[]; personaId?: string
}
```

주요 메서드: `create`, `get`, `addMessage`, `updateMessage`, `truncateAfter`, `fork`, `toggleMessagePin`, `delete`, `pin`, `addTag`, `removeTag`

### agent.ts — 에이전트 루프

```typescript
interface Tool {
  name: string; description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>
  execute: (params: Record<string, unknown>) => Promise<string>
}

interface AgentStep {
  id: string; type: 'thinking' | 'tool_call' | 'tool_result' | 'response';
  content: string; toolName?: string; toolInput?: Record<string, unknown>; ts: number
}

function runAgent(opts: AgentOptions): Promise<{ finalText: string; steps: AgentStep[] }>
```

XML 태그 기반 도구 호출 파싱:
```xml
<tool_call><name>web_search</name><params>{"query": "..."}</params></tool_call>
```

### usage.ts — 사용량 추적 [v3 강화]

```typescript
interface UsageRecord {
  date: string
  provider: ProviderType
  model: string
  feature: 'chat' | 'group' | 'tool' | 'agent' | 'debate' | 'report'  // [v3 신규]
  inputTokens: number
  outputTokens: number
  requests: number
  estimatedCost: number
}

// 가격표 (1M tokens 당 USD) — 전체 프로바이더
'claude-sonnet-4-6':       { input: 3.0, output: 15.0 }
'claude-opus-4-6':         { input: 15.0, output: 75.0 }
'claude-haiku-4-5':        { input: 0.8, output: 4.0 }
'gpt-4o':                  { input: 2.5, output: 10.0 }
'gpt-4o-mini':             { input: 0.15, output: 0.6 }
'gemini-2.0-flash-exp':    { input: 0.0, output: 0.0 }  // 무료 (실험)
'gemini-1.5-pro':          { input: 1.25, output: 5.0 }

// 토큰 추정: 한글 2자 ≈ 1토큰, 영문 4자 ≈ 1토큰
```

### personas.ts — 페르소나

내장 6종: 기본 어시스턴트, 개발자 도우미, 작문 코치, 통역사, 데이터 분석가, 튜터

### agentTools.ts — 내장 도구

| 도구 | 설명 | 안전성 |
|------|------|--------|
| `web_search` | DuckDuckGo/Google 검색 | 네트워크 오류 처리 |
| `read_page` | 현재 페이지 컨텍스트 | storage 접근 |
| `fetch_url` | URL 콘텐츠 가져오기 (6,000자) | script/style 제거 |
| `calculate` | JavaScript 수식 평가 | 정규식 안전 검증 |
| `get_datetime` | 현재 날짜/시간 (한국어) | 순수 함수 |

## 모듈 간 의존성 [v3 업데이트]

```
providers/
├── types.ts (기본 인터페이스)
├── bedrock-provider.ts ←── aws-sigv4.ts
├── openai-provider.ts
├── gemini-provider.ts
├── provider-factory.ts ←── 위 3개 프로바이더
└── model-router.ts

agent.ts ←── agentTools.ts ←── webSearch.ts
    ↑
chatHistory.ts ←── storage.ts
    ↑                  ↑
messageSearch.ts    bookmarks.ts
importChat.ts       tags.ts
exportChat.ts       personas.ts
summarize.ts        promptLibrary.ts
debate.ts          usage.ts (프로바이더별)
insightReport.ts   shortcuts.ts (chrome.storage 직접)
commentAnalyzer.ts
pdfParser.ts

pageContext.ts      (chrome.storage 직접)
pageReader.ts       (chrome.scripting, chrome.tabs)
searchIntent.ts     (의존성 없음 — 순수 함수)
writingTools.ts     (의존성 없음 — 상수 정의)
stt.ts / tts.ts     (Web Speech API만 사용)
```

## 스토리지 키 총괄

| 키 | 모듈 | 용도 |
|----|------|------|
| `hchat:conv:{id}` | chatHistory | 개별 대화 데이터 |
| `hchat:conv-index` | chatHistory | 대화 인덱스 (최대 200개) |
| `hchat:highlights` | bookmarks | 하이라이트 배열 |
| `hchat:highlight-index` | bookmarks | 하이라이트 인덱스 |
| `hchat:tags` | tags | 태그 정의 배열 |
| `hchat:prompts` | promptLibrary | 프롬프트 배열 |
| `hchat:personas` | personas | 커스텀 페르소나 배열 |
| `hchat:active-persona` | personas | 활성 페르소나 ID |
| `hchat:usage` | usage | 사용량 레코드 (90일 보관) |
| `hchat:summaries` | summarize | 대화별 요약 |
| `hchat:shortcuts` | shortcuts | 커스텀 단축키 |
| `hchat:search-cache:{hash}` | webSearch | 검색 결과 캐시 (1시간 TTL) |
| `hchat:page-context` | pageContext | 현재 페이지 컨텍스트 |
| `hchat:page-context-enabled` | pageContext | 컨텍스트 활성화 상태 |
| `hchat:config` | (useConfig) | 전체 설정 객체 |
| `hchat:doc-projects` | docProjects | 문서 프로젝트 인덱스 [v4.3 신규] |
| `hchat:doc-project:{id}` | docProjects | 개별 프로젝트 + 버전 [v4.3 신규] |
| `hchat:doc-templates` | docTemplateStore | 템플릿 갤러리 (Base64, max 10) [v4.3] |
| `hchat:chat-templates` | chatTemplates | 대화 템플릿 (max 20) [v5.0] |
| `hchat:guardrail-config` | guardrail | PII 가드레일 설정 [v5.0] |
| `hchat:assistants` | assistantBuilder | 커스텀 비서 정의 [v5.0] |
| `hchat:user-prefs` | userPreferences | 사용 패턴 학습 [v5.3] |
| `hchat:conv-summaries` | conversationSummarizer | 대화 요약 캐시 [v5.3] |
| `hchat:assistant-chains` | assistantChain | 비서 체인 정의 [v5.5] |
| `hchat:prompt-cache` | promptCache | 프롬프트 캐시 (max 100, TTL 24h) [v5.7] |
| `hchat:ai-memories` | aiMemory | AI 장기 기억 (max 100, FIFO) [v5.7] |
| `hchat:response-styles` | responseTemplate | 응답 스타일 커스텀 (max 20) [v5.7] |
| `hchat:workflows` | workflowBuilder | 워크플로우 정의 (max 20) [v5.7] |

## 설계 원칙

1. **Single Responsibility**: 각 모듈은 하나의 도메인만 담당
2. **Storage Abstraction**: `Storage` 래퍼로 chrome API 접근 통일
3. **Type Safety**: 모든 인터페이스/타입 export
4. **Error Handling**: 모든 비동기 함수에 try-catch + 한국어 에러 메시지
5. **Pure Functions**: `searchIntent.ts`, `writingTools.ts` 등 테스트 용이한 순수 함수 분리

## 성능 최적화

| 영역 | 전략 |
|------|------|
| 웹 검색 | 1시간 TTL 캐시 (`hchat:search-cache:`) |
| 스트리밍 | 청크 단위 처리 (메모리 효율) |
| 에이전트 | 도구 결과 4,000자 제한 |
| 페이지 읽기 | 본문 8,000자 제한 |
| 요약 | 최근 30개 메시지, 각 500자 제한, Haiku 모델 |
| 히스토리 인덱스 | 최대 200개 유지 |
| 사용량 | 90일 초과 데이터 자동 삭제 |

## 보안

| 영역 | 대책 |
|------|------|
| AWS 자격증명 | SigV4 서명으로 전송, chrome.storage 샌드박스 |
| 수식 평가 | 정규식 화이트리스트 (`calculate` 도구) |
| XSS | HTML 이스케이프 (`messageSearch`, `exportChat`) |
| CORS | DuckDuckGo HTML 스크레이핑, YouTube 페이지 컨텍스트 실행 |
