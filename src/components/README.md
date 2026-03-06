# src/components/

## 개요

사이드패널의 각 탭과 공용 UI 요소를 구성하는 61개 React 컴포넌트 (.tsx 파일). 채팅 인터페이스, 크로스 모델 그룹 채팅, 크로스 모델 토론, 도구 뷰, 설정, 히스토리, 북마크, 프롬프트 라이브러리, 사용량 통계, 비서 마켓플레이스 등 모든 사용자 인터페이스를 포함한다.

**v5.1 정리 (2026-03-05)**: react-markdown 제거 (~130KB 절감), PROVIDER_COLORS 상수 중앙화 (types.ts), 커스텀 MD 렌더러 유지.

## 파일 목록

| 파일 | 줄 수 | 설명 |
|------|-------|------|
| `ChatView.tsx` | 700+ | 메인 채팅 인터페이스 — 메시지, 스트리밍, 에이전트, TTS/STT, 내보내기, 분기 |
| `GroupChatView.tsx` | 200+ | 크로스 모델 그룹 채팅 — 모든 프로바이더 모델 동시 비교 [v3 강화] |
| `DebateView.tsx` | 420+ | 크로스 모델 토론 — 3라운드 토론 엔진, 비서 vs 비서 토론, 투표 시스템 + 스코어보드 [v5.6] |
| `ToolsView.tsx` | 400+ | AI 도구 모음 — 페이지 요약, YouTube 분석, 번역, 글쓰기, 문법, OCR, PDF 채팅 [v3 강화] |
| `PromptLibraryView.tsx` | 139 | 프롬프트 라이브러리 — CRUD, 카테고리 필터, 단축키 |
| `HistoryView.tsx` | 204 | 대화 기록 — 검색, 태그 필터, 고정, 가져오기 |
| `BookmarksView.tsx` | 165 | 하이라이트 북마크 — 색상, 메모, 태그, 검색 |
| `SettingsView.tsx` | 350+ | 설정 — 다중 프로바이더 자격증명, 기능 토글, 웹 검색, 키보드 단축키 설정 [v5.6] |
| `UsageView.tsx` | 150+ | 사용량 통계 — 프로바이더별/기능별 분류, 일별 비용 차트 [v3 강화] |
| `MessageSearchModal.tsx` | 111 | 전체 대화 검색 모달 — 디바운스, 키보드 네비게이션, 하이라이팅 |
| `ModelSelector.tsx` | 120+ | 모델 선택 드롭다운 — 9개 모델 (AWS, OpenAI, Google), PROVIDER_COLORS 사용 [v5.1] |
| `AssistantSelector.tsx` | 130+ | 커스텀 비서 선택 드롭다운 — 20개 내장 비서 + 커스텀 비서 [v5.0] |
| `ShortcutsConfig.tsx` | 150+ | 키보드 단축키 설정 — 키 레코더, 예약 콤보 감지, 기본값 복원 [v5.6] |
| `ChainBuilder.tsx` | 200+ | 비서 체인 관리 — CRUD, 단계 추가/삭제, export/import [v5.6 Phase 3] |

## 상세 설명

### ChatView.tsx (700줄) — 핵심 컴포넌트

가장 복잡한 컴포넌트로, 채팅의 전체 UI를 담당한다.

#### Props
```typescript
interface Props {
  config: Config
  onNewConv?: () => void
  loadConvId?: string                    // 외부에서 로드할 대화 ID
  contextEnabled?: boolean               // 페이지 컨텍스트 활성화
  onToggleContext?: () => void
  onRegisterActions?: (actions: {        // 단축키용 액션 등록
    startNew: () => void
    stop: () => void
    focusInput: () => void
  }) => void
  onForkConv?: (newConvId: string) => void
}
```

#### 내부 서브컴포넌트

| 이름 | 설명 |
|------|------|
| `CodeBlock` | 코드 블록 렌더링 + 복사 (JS, Python, HTML, JSON, SQL, C, Go, CSS 지원) |
| `MD` | 커스텀 마크다운 렌더러 (코드 블록, 헤더, 리스트, 강조, XSS 방지, v5.1에서 react-markdown 제거) |
| `SearchSources` | 웹 검색 출처 칩 표시 |
| `AgentStepsView` | 에이전트 도구 사용 내역 (확장/축소) |
| `MsgBubble` | 메시지 버블 (편집, 재생성, 복사, TTS, 핀, 분기) |

#### 주요 기능

- **메시지 전송**: 텍스트 + 이미지 첨부, 페이지 컨텍스트 주입
- **프롬프트 시스템**: `/` 입력 시 검색 팝업, 화살표 키 선택, Enter/Tab 적용
- **에이전트 모드**: 다중 턴 도구 호출 UI (thinking → tool_call → tool_result → response)
- **TTS/STT**: 음성 읽기/입력 토글
- **내보내기**: Markdown, HTML, JSON, TXT 형식
- **대화 분기**: 특정 메시지까지 분기 (fork)
- **메시지 고정**: 중요 메시지 핀
- **대화 요약**: AI 요약 생성 및 표시
- **제안 카드**: 빈 대화 시 4개 제안 (페이지 요약, 이메일 작성, 브레인스토밍, 번역)

---

### GroupChatView.tsx (200+줄) [v3 강화]

모든 프로바이더의 모델에 동시에 질문하여 응답을 비교하는 뷰.

#### 인터페이스
```typescript
interface ModelResponse {
  modelId: string
  provider: ProviderType  // 'bedrock' | 'openai' | 'gemini'
  text: string
  loading: boolean
  error?: string
  ms?: number  // 응답 시간 (밀리초)
}
```

#### 특징
- 모든 프로바이더 모델 선택 가능 (최대 9개)
- 병렬 스트리밍 호출 (각 프로바이더의 stream 메서드)
- 프로바이더별 색상 구분 (PROVIDER_COLORS 사용, v5.1)
- 각 모델별 응답 시간 측정 및 표시
- 그리드 레이아웃으로 나란히 비교

---

### DebateView.tsx (420+줄) [v5.6 강화]

서로 다른 AI 모델 또는 비서 간 토론을 진행하는 뷰.

#### 토론 구조
```typescript
interface DebateRound {
  round: number
  type: 'initial' | 'critique' | 'synthesis'
  responses: Array<{
    modelId: string
    provider: ProviderType
    text: string
  }>
}

interface DebateScoreboard {
  votes: Record<number, number>  // participantIndex → score (1-5)
  rank: number[]                 // participantIndex sorted by score
  avgScore: Record<number, number>
  consensus: number | null       // index of participant if consensus reached
}
```

#### 3라운드 토론 엔진
1. **라운드 1**: 각 모델이 질문에 독립적으로 답변
2. **라운드 2**: 각 모델이 다른 모델들의 답변을 비평
3. **라운드 3**: 각 모델이 최종 종합 의견 제시
4. **투표**: 각 참가자가 다른 참가자들을 1~5점으로 평가 (v5.6)

#### 특징
- 최소 2개, 최대 4개 모델/비서 선택
- 비서 vs 비서 토론 지원 (비서 시스템 프롬프트 자동 주입)
- 토론 기록 타임라인 시각화
- 라운드별 접기/펼치기
- 투표 및 스코어보드 (평균 점수, 순위, 컨센서스) [v5.6]
- 전체 토론 내보내기 (Markdown)

---

### ToolsView.tsx (230줄) [v4.3 강화]

17개 AI 도구를 제공하는 도구 모음 뷰. 도구별 서브 컴포넌트는 `tools/` 디렉토리에 분리.

| 도구 | 아이콘 | 설명 |
|------|--------|------|
| 페이지 요약 | 📄 | `getCurrentPageContent()`로 현재 탭 요약 |
| YouTube 분석 | ▶️ | 자막 요약 + 댓글 분석 (최대 200개) + 통합 리포트 [v3 강화] |
| 텍스트 번역 | 🌐 | 50개 언어 지원 드롭다운 |
| 글쓰기 도구 | ✏️ | 7가지 Writing Action (개선, 축약, 확장, 전문적, 캐주얼, 교정, 번역) |
| 문법 교정 | ✅ | 맞춤법/문법/표현 교정 + 이유 설명 |
| 이미지 OCR | 🔍 | Vision 모델 사용 (Claude, GPT) |
| PDF 채팅 | 📄 | PDF 업로드 → pdfjs-dist 텍스트 추출 → 질의응답 [v3 신규] |
| 문서 번역 | 📝 | TXT/CSV/XLSX/PPTX/PDF 번역, 포맷 유지 [v4.1, v4.3 확장] |
| 문서 작성 | 📋 | 5유형 AI 문서 생성, 프로젝트 관리 [v4.1, v4.3 확장] |
| 이미지 생성 | 🎨 | DALL-E 3 (3크기, HD/Standard) [v4.2 신규] |
| 템플릿 문서 | 📋 | DOCX 템플릿 → {{필드}} 추출 → AI 생성 [v4.3 신규] |
| 배치 OCR | 📸 | 최대 10장 동시 처리, 4모드 (일반/명함/영수증/스크린샷) [v4.0] |
| 데이터 분석 | 📊 | CSV/Excel 업로드 → AI 분석 [v3.1] |
| 딥 리서치 | 🔬 | 3단계 자동 리서치 (쿼리→검색→리포트) [v3.1] |
| PPT 기획 | 📊 | 주제→AI 목차→콘텐츠→PPTX 다운로드 [v5.0] |
| 멀티 탭 요약 | 📑 | 열린 탭 동시 요약 (최대 10개) |
| 페이지 검색 | 🔎 | 현재 페이지 내용 검색 |

#### YouTube 분석 (v3 강화)
- **자막 요약**: 기존 3단계 fallback 유지
- **댓글 분석**: YouTube Data API로 최대 200개 댓글 추출
  - 감정 분석 (긍정/부정/중립 비율)
  - 주요 토픽 추출
  - 대표 댓글 선정
- **통합 리포트**: 자막 + 댓글 종합 분석 Markdown 리포트 생성

---

### PromptLibraryView.tsx (139줄)

프롬프트 CRUD와 카테고리 필터링.

- **카테고리**: 전체, 읽기, 번역, 글쓰기, 코드, 분석, 설명
- **필드**: 제목, 내용 (`{{content}}` 플레이스홀더), 단축키 (`/sum` 등), 카테고리
- **기본 프롬프트 8개**: 페이지 요약, 번역, 문장 다듬기, 코드 리뷰, 이메일 작성, YouTube 요약, 논거 분석, ELI5
- **사용 횟수 추적**: `usageCount` 표시

---

### HistoryView.tsx (204줄)

대화 기록 관리.

- **검색**: 제목 기반 텍스트 검색
- **태그 필터**: 칩 형태 태그 선택기
- **고정/일반 구분**: 📌 고정됨 섹션 + 최근 대화 섹션
- **태그 관리**: 인라인 태그 추가/삭제
- **가져오기**: JSON 파일에서 ChatGPT/Claude/H Chat 대화 임포트
- **ConvItem**: 모델 이모지, 상대 시간, 태그 칩, 액션 버튼

---

### BookmarksView.tsx (165줄)

웹페이지 텍스트 하이라이트 관리.

- **색상 5종**: yellow, green, blue, pink, purple
- **기능**: 검색, 태그 필터, 색상 변경, 메모 편집, AI 요약 표시
- **페이지 링크**: 클릭 시 해당 URL로 이동

---

### SettingsView.tsx (350+줄) [v5.6 강화]

| 섹션 | 내용 |
|------|------|
| AWS Bedrock 설정 | Access Key ID, Secret Access Key (마스킹), Region, 연결 테스트 |
| OpenAI 설정 | API Key (마스킹), 연결 테스트 [v3 신규] |
| Google Gemini 설정 | API Key (마스킹), 연결 테스트 [v3 신규] |
| 기본 설정 | 기본 모델 (모든 프로바이더), 자동 라우팅 토글, 텍스트 선택 도구 토글, 검색 엔진 강화, 웹 검색 (RAG) |
| 웹 검색 설정 | Google Search API Key, CSE Engine ID (선택, 기본 DuckDuckGo) |
| 키보드 단축키 | `ShortcutsConfig` 컴포넌트 임베드, 키 레코더, 예약 콤보 감지, 기본값 복원 [v5.6] |
| 사용량 통계 | `UsageView` 컴포넌트 임베드 |
| 정보 | H Chat v3.0 로고, 지원 프로바이더 및 모델 표시 |

---

### UsageView.tsx (150+줄) [v3 강화]

토큰 사용량 및 비용 추정 대시보드.

- **요약 카드**: 총 요청, 총 토큰, 예상 비용 (USD)
- **프로바이더별 분류**: AWS Bedrock, OpenAI, Google Gemini 개별 표시
  - 각 프로바이더 색상 코드
  - 요청/토큰/비용 통계
- **기능별 분류**: 채팅, 그룹 채팅, 도구, 에이전트, 토론, 리포트 [v3 신규]
- **일별 비용 차트**: 최근 14일 바 차트 (프로바이더별 색상 스택)
- **기간 선택**: 7일/30일/90일

---

### MessageSearchModal.tsx (111줄)

`Ctrl+K`로 열리는 전체 대화 검색 모달.

- **디바운스**: 300ms 검색 지연
- **키보드**: ↑↓ 이동, Enter 선택, ESC 닫기
- **결과**: 대화 제목, 역할 (나/AI), 스니펫 하이라이팅, 상대 시간

---

### ModelSelector.tsx (120+줄) [v3 강화]

모델 선택 드롭다운. 프로바이더별 그룹화, 자격증명 없으면 해당 프로바이더 비활성화.

```typescript
MODELS = [
  // AWS Bedrock
  'Claude Sonnet 4.6 (권장)',
  'Claude Opus 4.6 (최고 추론)',
  'Claude Haiku 4.5 (빠름)',
  // OpenAI
  'GPT-4o (코드)',
  'GPT-4o mini (경제적)',
  // Google Gemini
  'Flash 2.0 (초고속)',
  'Pro 1.5 (긴 컨텍스트)'
]
```

#### 특징
- 프로바이더별 섹션 구분
- 각 프로바이더 아이콘 표시
- 자격증명 상태에 따라 활성/비활성
- 자동 라우팅 모드 토글

---

### AssistantSelector.tsx (130+줄) [v5.0]

커스텀 비서 선택 드롭다운. PersonaSelector 레거시를 대체.

- **내장 비서 20개**: 6개 카테고리 (문서작업, 번역통역, 분석기획, 코딩개발, 크리에이티브, 일반업무)
- **커스텀 비서**: 사용자가 생성한 비서 목록
- **특징**: 비서 아이콘, 이름, 설명 표시, 드롭다운에서 직접 선택
- **자동 설정**: 비서 선택 시 모델, 온도, 시스템 프롬프트 자동 적용

## 공통 패턴

### 비동기 데이터 로드
```typescript
const load = useCallback(async () => {
  const data = await SomeLib.fetch()
  setData(data)
}, [deps])
useEffect(() => { load() }, [load])
```

### 모달/드롭다운 외부 클릭 닫기
```typescript
<div className="overlay" onClick={onClose}>
  <div className="modal" onClick={(e) => e.stopPropagation()}>...</div>
</div>
```

### 키보드 네비게이션
```typescript
if (e.key === 'ArrowDown') setIdx((i) => Math.min(i + 1, max))
if (e.key === 'ArrowUp') setIdx((i) => Math.max(i - 1, 0))
if (e.key === 'Enter') handleSelect(items[idx])
if (e.key === 'Escape') handleClose()
```

## 컴포넌트 간 데이터 흐름

```
App.tsx (sidepanel)
├─ ChatView ← useChat hook ← providers, lib/chatHistory
│  ├─ ModelSelector ← providers, Config
│  ├─ AssistantSelector ← lib/assistantBuilder
│  ├─ VoiceConversation ← lib/voicePipeline (음성 대화 모드)
│  └─ (내부 MsgBubble, CodeBlock, MD, AgentStepsView, SearchSources)
├─ ChainBuilder ← lib/assistantChain, lib/assistantBuilder
├─ GroupChatView ← providers, Config
├─ ToolsView ← lib/pageReader, providers, lib/writingTools (17개 도구)
├─ PromptLibraryView ← lib/promptLibrary
├─ HistoryView ← lib/chatHistory, lib/tags, lib/importChat
├─ BookmarksView ← lib/bookmarks
├─ SettingsView ← useConfig, lib/aws-sigv4, lib/shortcuts
│  └─ UsageView ← lib/usage
├─ AssistantMarketplace ← lib/assistantBuilder (20개 내장 비서)
└─ MessageSearchModal ← lib/messageSearch
```

## 의존성

- **React 18**: useState, useEffect, useCallback, useRef, useMemo
- **hooks/**: useChat, useConfig
- **lib/**: 모든 비즈니스 로직 모듈
- **lib/types.ts**: PROVIDER_COLORS 상수 중앙 관리 (v5.1)
- **Chrome APIs**: chrome.storage, chrome.tabs
- **styles/global.css**: 공용 CSS 디자인 시스템
- **i18n/**: 3개 언어 (ko/en/ja, 893+ keys)
