# H Chat v3 Extension

멀티 AI 프로바이더 Chrome 올인원 어시스턴트 확장 프로그램

## Overview

H Chat v3.0은 Sider 스타일의 올인원 AI 브라우저 어시스턴트입니다. AWS Bedrock Claude, OpenAI GPT, Google Gemini를 통합 지원하며, 자동 모델 라우팅, 크로스 모델 토론, YouTube 분석, PDF 채팅, 검색 엔진 AI 카드, 글쓰기 어시스턴트 등 풍부한 기능을 제공합니다.

- **Version**: 3.0.0
- **Platform**: Chrome Extension (Manifest V3)
- **AI Providers**: AWS Bedrock (Claude), OpenAI (GPT), Google Gemini
- **GitHub**: https://github.com/sgtlim0/hchat-v2-extension
- **Vercel**: https://hchat-v2-extension.vercel.app/sidepanel.html

## Features

### 1. 멀티 AI 프로바이더 시스템 (v3 신규)
- **AWS Bedrock**: Claude Sonnet 4.6, Opus 4.6, Haiku 4.5
- **OpenAI**: GPT-4o, GPT-4o mini
- **Google Gemini**: Flash 2.0, Pro 1.5
- 모든 프로바이더 직접 스트리밍 (외부 SDK 미사용, fetch() + AsyncGenerator)
- Provider Factory 패턴으로 통합 관리
- 자동 모델 라우팅: 프롬프트 패턴 분석으로 최적 모델 선택

### 2. AI 채팅 (ChatView)
- 실시간 스트리밍 응답 (모든 프로바이더)
- 이미지 업로드 + Vision 지원 (Claude, GPT)
- 메시지 액션: 복사, 핀, 편집, 재생성, 포크
- 에이전트 모드 토글 (도구 호출 시각화)
- 웹 검색 소스 표시
- 내보내기 메뉴 (Markdown, HTML, JSON, TXT)
- TTS/STT 버튼
- 페이지 컨텍스트 인디케이터
- 프롬프트 라이브러리 연동
- 대화 포크 (분기점에서 새 대화)

### 3. 크로스 모델 그룹 채팅
- 모든 프로바이더의 모델 동시 비교
- 단일 입력 → 선택한 모든 모델에 병렬 전송
- 모델별 독립 스트리밍
- 모델별 응답 시간 표시
- 프로바이더 간 성능 비교

### 4. 크로스 모델 토론 (v3 신규)
- 3라운드 토론 엔진: 초기 답변 → 상호 비평 → 종합
- 서로 다른 AI 모델 간 토론 진행
- 토론 기록 시각화
- 최종 합의 도출

### 5. YouTube 콘텐츠 분석 (v3 신규)
| 기능 | 설명 |
|------|------|
| 자막 요약 | 3단계 fallback으로 자막 추출 + AI 요약 |
| 댓글 분석 | 최대 200개 댓글 추출, 감정 분석, 토픽 추출, 인사이트 도출 |
| 통합 리포트 | 자막 + 댓글 종합 분석 Markdown 리포트 생성 |

### 6. PDF 채팅 (v3 신규)
- pdfjs-dist를 이용한 PDF 텍스트 추출
- PDF 내용 기반 질의응답
- 페이지별 컨텍스트 추적

### 7. 검색 엔진 AI 카드 (v3 신규)
- Google, Bing, Naver 검색 결과에 AI 요약 카드 주입
- 검색 쿼리 자동 감지 및 AI 답변 생성
- 접을 수 있는 카드 UI, 전체 채팅 열기 지원

### 8. 글쓰기 어시스턴트 (v3 신규)
- 웹페이지의 모든 textarea에 플로팅 툴바 추가
- 7가지 변환: 개선, 축약, 확장, 전문적, 캐주얼, 교정, 번역
- 실시간 AI 변환 결과 적용

### 9. 도구 패널 (ToolsView)
| 도구 | 기능 |
|------|------|
| 📄 페이지 요약 | 현재 탭 내용 추출 + AI 요약 |
| ▶️ YouTube 분석 | 자막/댓글 분석, 통합 리포트 |
| 🌐 번역 | 50개 언어 지원 |
| ✏️ 글쓰기 도구 | 11가지 텍스트 변환 |
| ✅ 문법 교정 | AI 맞춤법/문법 교정 |
| 📸 OCR | 이미지 → 텍스트 추출 (Vision) |
| 📄 PDF 채팅 | PDF 업로드 후 질의응답 |

### 10. 웹 검색 + RAG
- **DuckDuckGo**: API 키 없이 HTML 파싱
- **Google Custom Search**: API 키 설정 시 사용
- **자동 감지**: 질문 패턴으로 검색 필요 여부 자동 판단
- **RAG**: 검색 결과를 시스템 프롬프트에 주입
- **캐시**: 쿼리별 1시간 캐시

### 11. 멀티턴 에이전트
- XML 기반 도구 호출 (`<tool_call>...</tool_call>`)
- 4가지 내장 도구:
  - `web_search`: 실시간 웹 검색
  - `read_page`: 현재 페이지 내용 읽기
  - `fetch_url`: 임의 URL 페치
  - `javascript_eval`: JS 코드 실행 (샌드박스)
- 최대 10 스텝 자동 실행
- 스텝별 시각화: thinking → tool_call → tool_result → response

### 12. 스마트 북마크/하이라이트
- 텍스트 하이라이팅 (5가지 색상: 노랑, 초록, 파랑, 핑크, 보라)
- XPath 기반 영속화 (페이지 새로고침 후 복원)
- AI 요약 자동 생성
- 태그 시스템
- 전체 검색
- 메모 추가/편집
- 전용 BookmarksView 탭

### 13. 페이지 컨텍스트 추적
- 자동 추출: URL, 제목, 본문 (최대 8000자), 페이지 타입
- SPA 네비게이션 감지 (MutationObserver)
- 텍스트 선택 실시간 추적
- `chrome.scripting.executeScript`로 실시간 추출
- 시맨틱 HTML 우선 탐색 (`article`, `[role="main"]`, `main`, `#content`, `.content`)

### 14. 키보드 단축키
| 단축키 | 동작 |
|--------|------|
| `Ctrl+N` | 새 채팅 |
| `/` | 입력창 포커스 |
| `Escape` | 생성 중지 |
| `Ctrl+K` | 히스토리 검색 |
| `Ctrl+Shift+P` | 페이지 컨텍스트 토글 |
| `Ctrl+]` / `Ctrl+[` | 다음/이전 탭 |
| `Ctrl+Shift+H` | 사이드패널 열기 (글로벌) |
| `Ctrl+Shift+S` | 빠른 페이지 요약 (글로벌) |

### 15. 내보내기/가져오기
- 5가지 내보내기 형식: Markdown, HTML, JSON, Plain Text, PDF
- 단일/대량 내보내기
- 클립보드 복사
- 메타데이터 포함 (타임스탬프, 모델, 에이전트 스텝)
- JSON 가져오기

### 16. 메시지 검색
- 모든 대화에서 전체 텍스트 검색
- `Ctrl+Shift+F` 모달
- 퍼지 매칭
- 대화 바로가기

### 17. 사용량 추적 (v3 강화)
- 토큰 추정 (한국어: 2자/토큰)
- 프로바이더별 비용 추정 (AWS, OpenAI, Google 개별 가격)
- 기능별 사용량 (채팅/그룹/도구/에이전트/토론/리포트)
- 일별 비용 차트
- 90일 보존

### 18. 프롬프트 라이브러리
- 8개 기본 프롬프트 (요약, 번역, 교정, 코드 리뷰, 이메일 등)
- 커스텀 프롬프트 생성/편집/삭제
- 단축어 지원 (예: `/sum`)
- 변수 치환 (`{{content}}`)

### 19. 페르소나 시스템
8가지 시스템 프롬프트 프리셋:
- 기본, 간결, 창의적, 기술적, 캐주얼, 전문적, 교육자, 비판적

### 20. 콘텐츠 스크립트 플로팅 툴바
텍스트 선택 시 7가지 동작:
- 💡 설명 | 🌐 번역 | 📄 요약 | ✏️ 재작성 | 🎩 격식체 | ✅ 문법 | 🖍️ 하이라이트

### 21. 대화 관리 (HistoryView)
- 검색, 태그 필터
- 대화 고정 (핀)
- 삭제 (확인)
- 태그 관리
- 포크 인디케이터

## Tech Stack

| 항목 | 기술 | 버전 |
|------|------|------|
| UI | React | 18.3.1 |
| 언어 | TypeScript | 5.5.3 |
| 빌드 | Vite | 5.4.2 |
| 확장 API | Chrome Manifest V3 | 3 |
| AI | Multi-Provider | AWS Bedrock, OpenAI, Google |
| Markdown | react-markdown + remark-gfm | 9.0.1 + 4.0.0 |
| 코드 하이라이트 | react-syntax-highlighter | - |
| PDF | pdfjs-dist | 4.x |
| 폰트 | IBM Plex Sans KR + IBM Plex Mono | - |
| 스타일 | CSS Variables (Dark) | - |

## Supported Models (v3)

### AWS Bedrock (Claude)
| 모델 | Model ID | 용도 |
|------|----------|------|
| Claude Sonnet 4.6 | `us.anthropic.claude-sonnet-4-6` | 기본 (권장) |
| Claude Opus 4.6 | `us.anthropic.claude-opus-4-6-v1` | 최고 추론 성능 |
| Claude Haiku 4.5 | `us.anthropic.claude-haiku-4-5-20251001-v1:0` | 빠른 응답 |

### OpenAI
| 모델 | Model ID | 용도 |
|------|----------|------|
| GPT-4o | `gpt-4o` | 코드 생성, 기술 작업 |
| GPT-4o mini | `gpt-4o-mini` | 빠르고 경제적 |

### Google Gemini
| 모델 | Model ID | 용도 |
|------|----------|------|
| Flash 2.0 | `gemini-2.0-flash-exp` | 초고속 응답 |
| Pro 1.5 | `gemini-1.5-pro` | 긴 컨텍스트, 복잡한 작업 |

## Project Structure

```
hchat-v2-extension/
├── manifest.json                  # Chrome MV3 매니페스트
├── package.json                   # 의존성 (React, remark, highlight 등)
├── vite.config.ts                 # 멀티 엔트리 + 정적 에셋 복사
├── tsconfig.json                  # TypeScript (ES2020, strict)
├── vercel.json                    # Vercel 배포 설정
├── sidepanel.html                 # 사이드패널 엔트리
├── popup.html                     # 팝업 엔트리
├── docs/
│   └── additional-features-design.md  # 기능 로드맵
├── public/
│   ├── icons/                     # 확장 아이콘 (16, 48, 128px)
│   └── content.css                # 하이라이트 스타일
└── src/
    ├── background/
    │   └── index.ts               # 서비스 워커 (410줄)
    │       ├── 컨텍스트 메뉴 (4개 동작)
    │       ├── 툴바 스트리밍 (Port 기반)
    │       ├── 하이라이트 저장/조회
    │       ├── 탭 활성화 → 컨텍스트 업데이트
    │       └── 키보드 커맨드 핸들러
    ├── content/
    │   ├── index.ts               # 콘텐츠 스크립트 메인 (115줄)
    │   │   ├── 페이지 컨텍스트 추적 (자동 추출)
    │   │   ├── SPA 네비게이션 감지
    │   │   ├── 텍스트 선택 추적
    │   │   └── 하이라이트 복원 (XPath)
    │   ├── toolbar.ts             # 플로팅 AI 툴바 (420줄)
    │   ├── search-injector.ts     # 검색 엔진 AI 카드 주입 [v3 신규]
    │   └── writing-assistant.ts   # Textarea 글쓰기 툴바 [v3 신규]
    │       ├── 7가지 텍스트 선택 동작
    │       ├── Bedrock 스트리밍 (Background Port)
    │       └── 결과 패널 (복사/채팅 계속)
    ├── sidepanel/
    │   ├── App.tsx                 # 메인 앱 (7탭 UI, 167줄)
    │   └── main.tsx               # React 마운트
    ├── popup/
    │   ├── PopupApp.tsx            # 빠른 실행기
    │   └── main.tsx               # React 마운트
    ├── components/                 # 12개 파일
    │   ├── ChatView.tsx            # 메인 채팅
    │   ├── GroupChatView.tsx       # 크로스 모델 비교
    │   ├── DebateView.tsx          # 크로스 모델 토론 [v3 신규]
    │   ├── ToolsView.tsx           # 도구 패널 (YouTube, PDF 등)
    │   ├── PromptLibraryView.tsx   # 프롬프트 라이브러리
    │   ├── HistoryView.tsx         # 대화 기록
    │   ├── BookmarksView.tsx       # 하이라이트 관리
    │   ├── SettingsView.tsx        # 설정 (다중 프로바이더)
    │   ├── UsageView.tsx           # 사용량 대시보드 (프로바이더별) [v3 강화]
    │   ├── MessageSearchModal.tsx  # 메시지 검색
    │   ├── ModelSelector.tsx       # 모델 드롭다운 (모든 프로바이더)
    │   └── PersonaSelector.tsx     # 페르소나 선택
    ├── hooks/
    │   ├── useChat.ts              # 채팅 상태 + 스트리밍 (256줄)
    │   ├── useConfig.ts            # 설정 관리 (62줄)
    │   ├── useProvider.ts          # 프로바이더 인스턴스, 모델 리스트 [v3 신규]
    │   └── useShortcuts.ts         # 키보드 단축키 (40줄)
    ├── lib/                        # 30+ 파일
    │   ├── providers/
    │   │   ├── types.ts            # AIProvider 인터페이스, ModelDef [v3 신규]
    │   │   ├── bedrock-provider.ts # AWS Bedrock Claude 프로바이더 [v3 신규]
    │   │   ├── openai-provider.ts  # OpenAI GPT 프로바이더 [v3 신규]
    │   │   ├── gemini-provider.ts  # Google Gemini 프로바이더 [v3 신규]
    │   │   ├── provider-factory.ts # 프로바이더 생성, 모델 탐색 [v3 신규]
    │   │   └── model-router.ts     # 자동 모델 라우팅 [v3 신규]
    │   ├── aws-sigv4.ts            # AWS SigV4 서명 (Web Crypto)
    │   ├── chatHistory.ts          # 대화 CRUD + 인덱스
    │   ├── agent.ts                # 멀티턴 에이전트
    │   ├── agentTools.ts           # 내장 도구 5개
    │   ├── webSearch.ts            # DuckDuckGo + Google
    │   ├── searchIntent.ts         # 검색 의도 감지
    │   ├── bookmarks.ts            # 하이라이트 CRUD
    │   ├── shortcuts.ts            # 키보드 단축키
    │   ├── pageContext.ts          # 페이지 컨텍스트
    │   ├── pageReader.ts           # 콘텐츠 추출 + YouTube 자막
    │   ├── commentAnalyzer.ts      # YouTube 댓글 분석 [v3 신규]
    │   ├── pdfParser.ts            # PDF 텍스트 추출 (pdfjs-dist) [v3 신규]
    │   ├── insightReport.ts        # YouTube 통합 리포트 [v3 신규]
    │   ├── debate.ts               # 크로스 모델 토론 엔진 [v3 신규]
    │   ├── exportChat.ts           # 4형식 내보내기
    │   ├── importChat.ts           # JSON 가져오기
    │   ├── messageSearch.ts        # 전체 텍스트 검색
    │   ├── usage.ts                # 토큰/비용 추적 (프로바이더별)
    │   ├── promptLibrary.ts        # 프롬프트 템플릿
    │   ├── personas.ts             # 페르소나 프리셋
    │   ├── summarize.ts            # 페이지 요약 + 캐시
    │   ├── writingTools.ts         # 7가지 글쓰기 액션 [v3 신규]
    │   ├── tags.ts                 # 대화 태그 관리
    │   ├── storage.ts              # chrome.storage 래퍼
    │   ├── stt.ts                  # Speech-to-Text (Web Speech API)
    │   └── tts.ts                  # Text-to-Speech (Web Speech API)
    └── styles/
        └── global.css              # 디자인 시스템 (~33KB)
```

## Architecture

### 전체 아키텍처

```
┌─────────────────────────────────────────────────┐
│                  Chrome Browser                  │
├──────────┬──────────┬──────────┬────────────────┤
│ Side     │ Popup    │ Content  │ Background     │
│ Panel    │          │ Script   │ Service Worker │
│ (7 tabs) │ (launch) │ (toolbar)│ (alarms, ctx)  │
├──────────┴──────────┴──────────┴────────────────┤
│              chrome.storage.local                │
├─────────────────────────────────────────────────┤
│              chrome.runtime messages             │
├─────────────────────────────────────────────────┤
│         AWS Bedrock (SigV4 → HTTPS)              │
│         ┌─────────────────────────┐              │
│         │ Claude Sonnet 4.6       │              │
│         │ Claude Opus 4.6         │              │
│         │ Claude Haiku 4.5        │              │
│         └─────────────────────────┘              │
└─────────────────────────────────────────────────┘
```

### 채팅 데이터 플로우

```
사용자 입력
    │
    ├─ 웹 검색 필요? ──→ searchIntent.ts 판단
    │       │
    │       └──→ webSearch.ts (DuckDuckGo/Google)
    │                │
    │                └──→ RAG 시스템 프롬프트 주입
    │
    ├─ 에이전트 모드? ──→ agent.ts (최대 10 스텝)
    │       │
    │       └──→ agentTools.ts (web_search, read_page, fetch_url, js_eval)
    │
    ├─ 페이지 컨텍스트? ──→ executeScript로 실시간 추출
    │       │
    │       └──→ pageContext.ts → 시스템 프롬프트 주입
    │
    └──→ models.ts → SigV4 서명 → Bedrock API
                │
                └──→ Event Stream 파싱 → 실시간 UI 업데이트
```

### YouTube 자막 추출 (3단계 Fallback)

```
1. window.ytInitialPlayerResponse (MAIN world, 초기 로드 시)
   ↓ 실패
2. window.ytplayer.config (SPA 네비게이션 후)
   ↓ 실패
3. HTML 소스에서 "captionTracks" 검색 (최후 수단)
```

### 하이라이트 플로우

```
텍스트 선택 → 플로팅 툴바 🖍️ 클릭
    │
    ├── DOM: <mark class="hchat-highlight-yellow"> 삽입
    └── Background: SAVE_HIGHLIGHT 메시지
            │
            └── chrome.storage에 저장 (XPath + text + offset)

페이지 로드 시:
    GET_HIGHLIGHTS → XPath로 위치 복원 → <mark> 재삽입
```

### 스토리지 스키마

| 키 | 데이터 | 용도 |
|----|--------|------|
| `hchat:config` | Config | AWS 자격증명, 모델, 테마, 기능 토글 |
| `hchat:config:aws` | AwsCredentials | 백그라운드 워커용 |
| `hchat:conversations` | ConvIndex[] | 대화 인덱스 (최근 200개) |
| `hchat:conv:{id}` | Conversation | 개별 대화 + 메시지 |
| `hchat:highlights` | Highlight[] | 모든 하이라이트 |
| `hchat:highlight-index` | HighlightIndex[] | URL별 인덱스 |
| `hchat:page-context` | PageContext | 현재 페이지 정보 |
| `hchat:prompts` | Prompt[] | 프롬프트 라이브러리 |
| `hchat:usage` | UsageRecord[] | 사용량 기록 |
| `hchat:search-cache:{hash}` | SearchResult | 웹 검색 캐시 (1시간) |
| `hchat:shortcuts` | ShortcutMap | 키보드 단축키 |

## Manifest Permissions

| 권한 | 용도 |
|------|------|
| `storage` | 대화 기록, 설정, 하이라이트, 사용량 |
| `alarms` | 향후 스케줄러 (예약) |
| `sidePanel` | 사이드패널 API |
| `notifications` | 알림 |
| `contextMenus` | 우클릭 메뉴 (설명, 번역, 요약, 재작성) |
| `activeTab` | 현재 탭 콘텐츠 접근 |
| `scripting` | executeScript (페이지 컨텍스트, YouTube) |
| `tabs` | 탭 관리 |

**Host Permissions**:
- `https://bedrock-runtime.*.amazonaws.com/*` — Bedrock API
- `<all_urls>` — 콘텐츠 스크립트 주입

**Commands**:
- `Ctrl+Shift+H` — 사이드패널 열기
- `Ctrl+Shift+S` — 빠른 페이지 요약

## Setup & Development

### 필수 요구사항
- Node.js 18+
- AWS Bedrock 접근 권한 (Claude 모델 활성화)
- AWS Access Key ID + Secret Access Key

### 설치 및 개발

```bash
npm install
npm run dev        # watch 모드 빌드
npm run build      # 프로덕션 빌드 → dist/
```

### Chrome 로드

1. `chrome://extensions` 열기
2. "개발자 모드" 활성화
3. "압축해제된 확장 프로그램을 로드합니다" → `dist/` 폴더 선택

### 초기 설정

1. 확장 아이콘 클릭 → 사이드패널 열기
2. ⚙️ 설정 탭에서 AWS 자격증명 입력
3. "연결 테스트" 확인
4. (선택) Google 검색 API 키 설정 (웹 검색 강화)

## 버전 히스토리

### v3.0 (2026-03) — 멀티 AI 프로바이더 시스템

#### v3에서 추가 (10개 주요 기능)
| 기능 | 설명 |
|------|------|
| 멀티 AI 프로바이더 | AWS Bedrock, OpenAI, Google Gemini 통합 지원 |
| 자동 모델 라우팅 | 프롬프트 패턴 분석으로 최적 모델 자동 선택 |
| 크로스 모델 토론 | 서로 다른 AI 모델 간 3라운드 토론 엔진 |
| YouTube 댓글 분석 | 최대 200개 댓글 감정/토픽 분석 + 통합 리포트 |
| PDF 채팅 | pdfjs-dist 기반 PDF 텍스트 추출 + 질의응답 |
| 검색 엔진 AI 카드 | Google/Bing/Naver에 AI 요약 카드 주입 |
| 글쓰기 어시스턴트 | Textarea에 플로팅 툴바, 7가지 변환 |
| 프로바이더별 사용량 | AWS/OpenAI/Google 개별 비용 추적, 기능별 분류 |
| 프로바이더 팩토리 | createAllProviders, getProviderForModel, getAllModels |
| useProvider 훅 | 메모이제이션된 프로바이더 인스턴스, 모델 리스트 |

### v2.0 (2025-12) — 웹 검색 + 에이전트 시스템

| 기능 | 설명 |
|------|------|
| 웹 검색 + RAG | DuckDuckGo/Google 검색 → 컨텍스트 주입 |
| 멀티턴 에이전트 | XML 도구 호출 (5개 내장 도구, 최대 10스텝) |
| 스마트 북마크 | XPath 하이라이트, 5색, AI 요약, 태그 |
| 페이지 컨텍스트 | 실시간 추출, SPA 감지, 시스템 프롬프트 주입 |
| 키보드 단축키 | 7개 기본 + 2개 글로벌 단축키 |
| 내보내기/가져오기 | MD, HTML, JSON, TXT |
| 메시지 검색 | 전체 대화 풀텍스트 검색 |
| 사용량 추적 | 토큰/비용 추정, 일별/월별 차트 |
| 그룹 채팅 | 최대 7모델 동시 비교 (Claude만) |
| YouTube 요약 | 자막 추출 (3단계 fallback) + AI 요약 |

### 규모 비교
| 항목 | v1 | v2 | v3 |
|------|:--:|:--:|:--:|
| 소스 파일 | ~22개 | ~40개 | ~50개 |
| 코드 라인 | ~4,000 | ~8,000 | ~10,000+ |
| 탭 수 | 5개 | 7개 | 8개 |
| lib 파일 | 6개 | 20개 | 30개 |
| AI 프로바이더 | 1개 | 1개 | 3개 |
| 지원 모델 | 3개 | 3개 | 9개 |

## Design System

### 색상 (Dark 테마 기본)

| 토큰 | Light | Dark |
|------|-------|------|
| Primary | `#3478FE` | `#5B93FF` |
| Background (Page) | `#FFFFFF` | `#1A1A1A` |
| Background (Sidebar) | `#F8F9FA` | `#1E1E1E` |
| Background (Card) | `#F8F9FA` | `#2A2A2A` |
| Background (Hover) | `#EEF2F6` | `#333333` |
| Text Primary | `#1A1A1A` | `#F0F0F0` |
| Text Secondary | `#6B7280` | `#9CA3AF` |
| Border | `#E5E7EB` | `#374151` |
| Success | `#22C55E` | `#22C55E` |
| Danger | `#EF4444` | `#EF4444` |

### 타이포그래피
- **Sans**: Inter (300-700)
- **Mono**: JetBrains Mono (300-600)
- **본문**: 13px, line-height 1.6

## Security

- AWS 자격증명: `chrome.storage.local` 전용 (동기화/외부 전송 없음)
- AWS Bedrock 직접 통신 (HTTPS, SigV4 서명)
- 모든 데이터 로컬 저장 (텔레메트리, 분석 없음)
- 콘텐츠 스크립트: 격리된 world에서 실행
- JavaScript eval 도구: 페이지 컨텍스트에서 샌드박스 실행

## License

Private
