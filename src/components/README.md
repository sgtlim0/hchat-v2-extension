# src/components/

## 개요

사이드패널의 각 탭과 공용 UI 요소를 구성하는 11개 React 컴포넌트. 채팅 인터페이스, 도구 뷰, 설정, 히스토리, 북마크, 프롬프트 라이브러리, 사용량 통계 등 모든 사용자 인터페이스를 포함한다.

## 파일 목록

| 파일 | 줄 수 | 설명 |
|------|-------|------|
| `ChatView.tsx` | 700 | 메인 채팅 인터페이스 — 메시지, 스트리밍, 에이전트, TTS/STT, 내보내기, 분기 |
| `GroupChatView.tsx` | 158 | 그룹 채팅 — 여러 모델 동시 질의 및 응답 비교 |
| `ToolsView.tsx` | 268 | AI 도구 모음 — 요약, YouTube 요약, 번역, 글쓰기, 문법, OCR |
| `PromptLibraryView.tsx` | 139 | 프롬프트 라이브러리 — CRUD, 카테고리 필터, 단축키 |
| `HistoryView.tsx` | 204 | 대화 기록 — 검색, 태그 필터, 고정, 가져오기 |
| `BookmarksView.tsx` | 165 | 하이라이트 북마크 — 색상, 메모, 태그, 검색 |
| `SettingsView.tsx` | 244 | 설정 — AWS Bedrock 자격증명, 기능 토글, 웹 검색 설정, 단축키 |
| `UsageView.tsx` | 101 | 사용량 통계 — 요청/토큰/비용, 프로바이더별, 일별 차트 |
| `MessageSearchModal.tsx` | 111 | 전체 대화 검색 모달 — 디바운스, 키보드 네비게이션, 하이라이팅 |
| `ModelSelector.tsx` | 87 | 모델 선택 드롭다운 — Sonnet 4.6, Opus 4.6, Haiku 4.5 |
| `PersonaSelector.tsx` | 128 | 페르소나 선택/생성 — 내장 6종 + 커스텀 생성 |

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
| `MD` | 마크다운 렌더링 (코드 블록, 헤더, 리스트, 강조, XSS 방지) |
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

### GroupChatView.tsx (158줄)

여러 Claude 모델에 동시에 질문하여 응답을 비교하는 뷰.

#### 인터페이스
```typescript
interface ModelResponse {
  modelId: string
  text: string
  loading: boolean
  error?: string
  ms?: number  // 응답 시간 (밀리초)
}
```

#### 특징
- 모델 선택 토글 (Sonnet/Opus/Haiku)
- 병렬 `streamChatLive()` 호출
- 각 모델별 응답 시간 측정 및 표시
- 그리드 레이아웃으로 나란히 비교

---

### ToolsView.tsx (268줄)

6개 AI 도구를 제공하는 도구 모음 뷰.

| 도구 | 아이콘 | 설명 |
|------|--------|------|
| 페이지 요약 | 📄 | `getCurrentPageContent()`로 현재 탭 요약 |
| YouTube 요약 | ▶️ | `getYouTubeTranscript()`로 자막 기반 요약 |
| 텍스트 번역 | 🌐 | 50개 언어 지원 드롭다운 |
| 글쓰기 도구 | ✏️ | 11가지 Writing Action 버튼 그리드 |
| 문법 교정 | ✅ | 맞춤법/문법/표현 교정 + 이유 설명 |
| 이미지 OCR | 🔍 | Claude Sonnet 4.6 비전 모델 사용 |

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

### SettingsView.tsx (244줄)

| 섹션 | 내용 |
|------|------|
| AWS Bedrock 설정 | Access Key ID, Secret Access Key (마스킹), Region, 연결 테스트 |
| 기본 설정 | 기본 모델, 텍스트 선택 도구 토글, 검색 엔진 강화, 웹 검색 (RAG) |
| 웹 검색 설정 | Google Search API Key, CSE Engine ID (선택, 기본 DuckDuckGo) |
| 키보드 단축키 | 전체 단축키 목록, Mac/Windows 자동 표시 |
| 사용량 통계 | `UsageView` 컴포넌트 임베드 |
| 정보 | H Chat v2.0 로고, 지원 모델 표시 |

---

### UsageView.tsx (101줄)

토큰 사용량 및 비용 추정 대시보드.

- **요약 카드**: 총 요청, 총 토큰, 예상 비용 (USD)
- **프로바이더별**: 색상 코드 + 요청/토큰/비용
- **일별 차트**: 최근 14일 바 차트 (툴팁)
- **기간 선택**: 7일/30일/90일

---

### MessageSearchModal.tsx (111줄)

`Ctrl+K`로 열리는 전체 대화 검색 모달.

- **디바운스**: 300ms 검색 지연
- **키보드**: ↑↓ 이동, Enter 선택, ESC 닫기
- **결과**: 대화 제목, 역할 (나/AI), 스니펫 하이라이팅, 상대 시간

---

### ModelSelector.tsx (87줄)

모델 선택 드롭다운. AWS 자격증명 없으면 선택 불가.

```typescript
MODELS = [
  'Claude Sonnet 4.6 (권장)',
  'Claude Opus 4.6 (최고 성능)',
  'Claude Haiku 4.5 (빠름)'
]
```

---

### PersonaSelector.tsx (128줄)

페르소나 선택 및 커스텀 생성.

- **내장 6종**: 기본 어시스턴트, 개발자 도우미, 작문 코치, 통역사, 데이터 분석가, 튜터
- **커스텀 생성**: 아이콘, 이름, 설명, 시스템 프롬프트 입력
- **삭제**: 커스텀만 삭제 가능 (builtin 보호)

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
├─ ChatView ← useChat hook ← lib/models, lib/chatHistory
│  ├─ ModelSelector ← MODELS, Config
│  ├─ PersonaSelector ← Personas
│  └─ (내부 MsgBubble, CodeBlock, MD, AgentStepsView, SearchSources)
├─ GroupChatView ← lib/models, Config
├─ ToolsView ← lib/pageReader, lib/models, lib/writingTools
├─ PromptLibraryView ← lib/promptLibrary
├─ HistoryView ← lib/chatHistory, lib/tags, lib/importChat
├─ BookmarksView ← lib/bookmarks
├─ SettingsView ← useConfig, lib/aws-sigv4, lib/shortcuts
│  └─ UsageView ← lib/usage
└─ MessageSearchModal ← lib/messageSearch
```

## 의존성

- **React 18**: useState, useEffect, useCallback, useRef, useMemo
- **hooks/**: useChat, useConfig
- **lib/**: 모든 비즈니스 로직 모듈
- **Chrome APIs**: chrome.storage, chrome.tabs
- **styles/global.css**: 공용 CSS 디자인 시스템
