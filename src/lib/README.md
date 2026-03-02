# src/lib/

## 개요

비즈니스 로직과 유틸리티 함수를 캡슐화하는 라이브러리 모듈. 총 20개 파일, 약 2,500줄. API 통신, 데이터 관리, AI 기능, 검색, 음성, 내보내기/가져오기를 담당한다. 모든 모듈은 `Storage` 래퍼를 통해 `chrome.storage.local`에 접근한다.

## 파일 목록

| 파일 | 줄 수 | 카테고리 | 설명 |
|------|-------|----------|------|
| `models.ts` | 178 | API | AI 모델 정의 + Bedrock 스트리밍 (Event Stream 파싱) |
| `aws-sigv4.ts` | 94 | API | AWS Signature V4 서명 (Web Crypto API) |
| `chatHistory.ts` | 204 | 데이터 | 대화 기록 CRUD, 메시지 관리, 분기, 고정 |
| `agent.ts` | 240 | AI | 다중 턴 에이전트 루프 (XML 기반 도구 호출) |
| `agentTools.ts` | 100 | AI | 내장 도구 5종 (web_search, read_page, fetch_url, calculate, get_datetime) |
| `webSearch.ts` | 131 | 검색 | DuckDuckGo HTML 스크레이핑 + Google CSE, 1시간 캐시 |
| `searchIntent.ts` | 52 | 검색 | 규칙 기반 웹 검색 의도 감지 (패턴 매칭) |
| `bookmarks.ts` | 148 | 데이터 | 하이라이트 CRUD, XPath 유틸, 상대 시간 포맷 |
| `shortcuts.ts` | 66 | 설정 | 키보드 단축키 정의, 파싱, 매칭, 커스터마이징 |
| `pageContext.ts` | 55 | 컨텍스트 | 페이지 유형 감지, 시스템 프롬프트 생성, 컨텍스트 토글 |
| `pageReader.ts` | 137 | 컨텍스트 | 현재 탭 콘텐츠 추출, YouTube 자막 추출 (3단계) |
| `exportChat.ts` | 128 | 내보내기 | Markdown/HTML/JSON/TXT 내보내기, 클립보드 복사 |
| `importChat.ts` | 188 | 가져오기 | ChatGPT/Claude/H Chat JSON 가져오기 |
| `messageSearch.ts` | 74 | 검색 | 전체 대화 전문 검색, 스니펫 + 하이라이팅 |
| `usage.ts` | 139 | 추적 | 토큰 사용량/비용 추적, 추정, 90일 보관 |
| `promptLibrary.ts` | 67 | 설정 | 프롬프트 CRUD, 기본 8개, 단축키 검색 |
| `personas.ts` | 124 | 설정 | 페르소나 관리, 내장 6종 + 커스텀 CRUD |
| `summarize.ts` | 78 | AI | AI 대화 요약 (Haiku 모델, 최근 30개 메시지) |
| `writingTools.ts` | 33 | 상수 | 글쓰기 액션 11종 정의 (프롬프트 템플릿) |
| `tags.ts` | 59 | 데이터 | 대화 태그 CRUD, 자동 색상 할당, 사용 횟수 |
| `storage.ts` | 20 | 인프라 | chrome.storage.local 래퍼 (get/set/remove/getAll) |
| `stt.ts` | 114 | 음성 | Web Speech Recognition API 래퍼 (한국어, 연속 모드) |
| `tts.ts` | 105 | 음성 | Web Speech Synthesis API 래퍼 (마크다운 정리, 한국어 음성) |

## 주요 인터페이스

### models.ts — AI 모델 및 스트리밍

```typescript
type Provider = 'claude'

interface ModelDef {
  id: string; provider: Provider; label: string; shortLabel: string; emoji: string
}

const MODELS: ModelDef[] = [
  { id: 'us.anthropic.claude-sonnet-4-6', shortLabel: 'Sonnet 4.6', ... },
  { id: 'us.anthropic.claude-opus-4-6-v1', shortLabel: 'Opus 4.6', ... },
  { id: 'us.anthropic.claude-haiku-4-5-20251001-v1:0', shortLabel: 'Haiku 4.5', ... },
]

interface StreamOptions {
  aws: AwsCredentials; model: string; messages: Message[];
  systemPrompt?: string; maxTokens?: number; onChunk: (text: string) => void
}

function streamChatLive(opts: StreamOptions): Promise<string>
```

AWS Bedrock Event Stream 바이너리 프로토콜을 직접 파싱: `[4B totalLen][4B headersLen][4B preludeCRC][headers...][payload...][4B msgCRC]`

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

### usage.ts — 사용량 추적

```typescript
interface UsageRecord {
  date: string; provider: Provider; model: string;
  inputTokens: number; outputTokens: number; requests: number; estimatedCost: number
}

// 가격표 (1M tokens 당 USD)
'claude-sonnet-4-6':       { input: 3.0, output: 15.0 }
'claude-opus-4-6':         { input: 15.0, output: 75.0 }
'claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 }

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

## 모듈 간 의존성

```
models.ts ←── aws-sigv4.ts
    ↑
agent.ts ←── agentTools.ts ←── webSearch.ts
    ↑
chatHistory.ts ←── storage.ts
    ↑                  ↑
messageSearch.ts    bookmarks.ts
importChat.ts       tags.ts
exportChat.ts       personas.ts
summarize.ts        promptLibrary.ts
                    usage.ts
                    shortcuts.ts (chrome.storage 직접)

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
