# H Chat v2 Extension

AWS Bedrock Claude 기반 Chrome AI 올인원 어시스턴트 확장 프로그램

## Overview

H Chat v2는 Sider 스타일의 올인원 AI 브라우저 어시스턴트입니다. AWS Bedrock을 통해 Claude 모델과 직접 통신하며, 웹 검색, 멀티턴 에이전트, 스마트 북마크, 페이지 컨텍스트 추적, 그룹 채팅 등 풍부한 기능을 제공합니다.

- **Version**: 2.0.0
- **Platform**: Chrome Extension (Manifest V3)
- **AI Provider**: AWS Bedrock (Claude)
- **GitHub**: https://github.com/sgtlim0/hchat-v2-extension
- **Vercel**: https://hchat-v2-extension.vercel.app/sidepanel.html

## Features

### 1. AI 채팅 (ChatView) — 699줄
- 실시간 스트리밍 응답 (AWS Event Stream)
- 이미지 업로드 + Claude Vision 지원
- 메시지 액션: 복사, 핀, 편집, 재생성, 포크
- 에이전트 모드 토글 (도구 호출 시각화)
- 웹 검색 소스 표시
- 내보내기 메뉴 (5가지 포맷)
- TTS/STT 버튼
- 페이지 컨텍스트 인디케이터
- 프롬프트 라이브러리 연동
- 대화 포크 (분기점에서 새 대화)

### 2. 그룹 채팅 (GroupChatView)
- 최대 7개 모델 동시 비교
- 단일 입력 → 모든 모델에 동시 전송
- 모델별 독립 스트리밍
- 모델별 응답 시간 표시

### 3. 도구 패널 (ToolsView) — 6가지 도구
| 도구 | 기능 |
|------|------|
| 📄 페이지 요약 | 현재 탭 내용 추출 + AI 요약 |
| ▶️ YouTube 요약 | 자막 추출 + AI 요약 (3단계 fallback) |
| 🌐 번역 | 10개 언어 지원 |
| ✏️ 글쓰기 도구 | 11가지 텍스트 변환 (개선, 축약, 확장, 전문적, 캐주얼 등) |
| ✅ 문법 교정 | AI 맞춤법/문법 교정 |
| 📸 OCR | 이미지 → 텍스트 추출 (Vision) |

### 4. 웹 검색 + RAG (v2 신규)
- **DuckDuckGo**: API 키 없이 HTML 파싱
- **Google Custom Search**: API 키 설정 시 사용
- **자동 감지**: 질문 패턴으로 검색 필요 여부 자동 판단
- **RAG**: 검색 결과를 시스템 프롬프트에 주입
- **캐시**: 쿼리별 1시간 캐시

### 5. 멀티턴 에이전트 (v2 신규)
- XML 기반 도구 호출 (`<tool_call>...</tool_call>`)
- 4가지 내장 도구:
  - `web_search`: 실시간 웹 검색
  - `read_page`: 현재 페이지 내용 읽기
  - `fetch_url`: 임의 URL 페치
  - `javascript_eval`: JS 코드 실행 (샌드박스)
- 최대 10 스텝 자동 실행
- 스텝별 시각화: thinking → tool_call → tool_result → response

### 6. 스마트 북마크/하이라이트 (v2 신규)
- 텍스트 하이라이팅 (5가지 색상: 노랑, 초록, 파랑, 핑크, 보라)
- XPath 기반 영속화 (페이지 새로고침 후 복원)
- AI 요약 자동 생성
- 태그 시스템
- 전체 검색
- 메모 추가/편집
- 전용 BookmarksView 탭

### 7. 페이지 컨텍스트 추적 (v2 신규)
- 자동 추출: URL, 제목, 본문 (최대 8000자), 페이지 타입
- SPA 네비게이션 감지 (MutationObserver)
- 텍스트 선택 실시간 추적
- `chrome.scripting.executeScript`로 실시간 추출
- 시맨틱 HTML 우선 탐색 (`article`, `[role="main"]`, `main`, `#content`, `.content`)

### 8. 키보드 단축키 (v2 신규)
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

### 9. 내보내기/가져오기 (v2 신규)
- 5가지 내보내기 형식: Markdown, HTML, JSON, Plain Text, PDF
- 단일/대량 내보내기
- 클립보드 복사
- 메타데이터 포함 (타임스탬프, 모델, 에이전트 스텝)
- JSON 가져오기

### 10. 메시지 검색 (v2 신규)
- 모든 대화에서 전체 텍스트 검색
- `Ctrl+Shift+F` 모달
- 퍼지 매칭
- 대화 바로가기

### 11. 사용량 추적 (v2 신규)
- 토큰 추정 (한국어: 2자/토큰)
- 모델별 비용 추정
- 일별/월별 요약
- 90일 보존

### 12. 프롬프트 라이브러리
- 8개 기본 프롬프트 (요약, 번역, 교정, 코드 리뷰, 이메일 등)
- 커스텀 프롬프트 생성/편집/삭제
- 단축어 지원 (예: `/sum`)
- 변수 치환 (`{{content}}`)

### 13. 페르소나 시스템
8가지 시스템 프롬프트 프리셋:
- 기본, 간결, 창의적, 기술적, 캐주얼, 전문적, 교육자, 비판적

### 14. 콘텐츠 스크립트 플로팅 툴바
텍스트 선택 시 7가지 동작:
- 💡 설명 | 🌐 번역 | 📄 요약 | ✏️ 재작성 | 🎩 격식체 | ✅ 문법 | 🖍️ 하이라이트

### 15. 대화 관리 (HistoryView)
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
| AI | AWS Bedrock | Claude |
| Markdown | react-markdown + remark-gfm | 9.0.1 + 4.0.0 |
| 코드 하이라이트 | react-syntax-highlighter | - |
| 폰트 | Inter + JetBrains Mono | - |
| 스타일 | CSS Variables (Dark/Light) | - |

## Supported Models

| 모델 | Bedrock Model ID | 용도 |
|------|-------------------|------|
| Claude Sonnet 4.6 | `us.anthropic.claude-sonnet-4-6` | 기본 (권장) |
| Claude Opus 4.6 | `us.anthropic.claude-opus-4-6-v1` | 최고 성능 |
| Claude Haiku 4.5 | `us.anthropic.claude-haiku-4-5-20251001-v1:0` | 빠른 응답 |

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
    │   └── toolbar.ts             # 플로팅 AI 툴바 (420줄)
    │       ├── 7가지 텍스트 선택 동작
    │       ├── Bedrock 스트리밍 (Background Port)
    │       └── 결과 패널 (복사/채팅 계속)
    ├── sidepanel/
    │   ├── App.tsx                 # 메인 앱 (7탭 UI, 167줄)
    │   └── main.tsx               # React 마운트
    ├── popup/
    │   ├── PopupApp.tsx            # 빠른 실행기
    │   └── main.tsx               # React 마운트
    ├── components/                 # 11개 파일, ~2,300줄
    │   ├── ChatView.tsx            # 메인 채팅 (699줄)
    │   ├── GroupChatView.tsx       # 멀티모델 비교 (157줄)
    │   ├── ToolsView.tsx           # 도구 패널 (267줄)
    │   ├── PromptLibraryView.tsx   # 프롬프트 라이브러리 (138줄)
    │   ├── HistoryView.tsx         # 대화 기록 (203줄)
    │   ├── BookmarksView.tsx       # 하이라이트 관리 (164줄) [v2 신규]
    │   ├── SettingsView.tsx        # 설정 (243줄)
    │   ├── UsageView.tsx           # 사용량 대시보드 (100줄) [v2 신규]
    │   ├── MessageSearchModal.tsx  # 메시지 검색 (110줄) [v2 신규]
    │   ├── ModelSelector.tsx       # 모델 드롭다운 (86줄)
    │   └── PersonaSelector.tsx     # 페르소나 선택 (127줄)
    ├── hooks/
    │   ├── useChat.ts              # 채팅 상태 + 스트리밍 (256줄)
    │   ├── useConfig.ts            # 설정 관리 (62줄)
    │   └── useShortcuts.ts         # 키보드 단축키 (40줄) [v2 신규]
    ├── lib/                        # 20개 파일
    │   ├── models.ts               # Bedrock 모델 정의 + 스트리밍 (178줄)
    │   ├── aws-sigv4.ts            # AWS SigV4 서명 (Web Crypto)
    │   ├── chatHistory.ts          # 대화 CRUD + 인덱스 (204줄)
    │   ├── agent.ts                # 멀티턴 에이전트 (240줄) [v2 신규]
    │   ├── agentTools.ts           # 내장 도구 4개 [v2 신규]
    │   ├── webSearch.ts            # DuckDuckGo + Google (131줄) [v2 신규]
    │   ├── searchIntent.ts         # 검색 의도 감지 [v2 신규]
    │   ├── bookmarks.ts            # 하이라이트 CRUD (148줄) [v2 신규]
    │   ├── shortcuts.ts            # 키보드 단축키 (66줄) [v2 신규]
    │   ├── pageContext.ts          # 페이지 컨텍스트 [v2 신규]
    │   ├── pageReader.ts           # 콘텐츠 추출 + YouTube 자막
    │   ├── exportChat.ts           # 5형식 내보내기 [v2 신규]
    │   ├── importChat.ts           # JSON 가져오기 [v2 신규]
    │   ├── messageSearch.ts        # 전체 텍스트 검색 [v2 신규]
    │   ├── usage.ts                # 토큰/비용 추적 (139줄) [v2 신규]
    │   ├── promptLibrary.ts        # 프롬프트 템플릿
    │   ├── personas.ts             # 8개 페르소나 프리셋
    │   ├── summarize.ts            # 페이지 요약 + 캐시
    │   ├── writingTools.ts         # 11가지 텍스트 변환
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

## v1 → v2 변경 사항

### v2에서 추가 (12개 신규 기능)
| 기능 | 설명 |
|------|------|
| 웹 검색 + RAG | DuckDuckGo/Google 검색 → 컨텍스트 주입 |
| 멀티턴 에이전트 | XML 도구 호출 (4개 내장 도구, 최대 10스텝) |
| 스마트 북마크 | XPath 하이라이트, 5색, AI 요약, 태그 |
| 페이지 컨텍스트 | 실시간 추출, SPA 감지, 시스템 프롬프트 주입 |
| 키보드 단축키 | 7개 기본 + 2개 글로벌 단축키 |
| 내보내기/가져오기 | MD, HTML, JSON, TXT, PDF |
| 메시지 검색 | 전체 대화 풀텍스트 검색 |
| 사용량 추적 | 토큰/비용 추정, 일별/월별 차트 |
| 그룹 채팅 | 최대 7모델 동시 비교 |
| YouTube 요약 | 자막 추출 (3단계 fallback) + AI 요약 |
| OCR | 이미지 → 텍스트 (Vision) |
| TTS/STT | 음성 입출력 (Web Speech API) |

### v1에서 제거
| 기능 | 이유 |
|------|------|
| 대화 메모리 (CLAUDE.md) | 페이지 컨텍스트 + 에이전트로 대체 |
| 작업 스케줄러 | 개인 생산성 도구 중심으로 변경 |
| 에이전트 스웜 | 멀티턴 에이전트 (순차 도구 호출)로 대체 |

### 규모 비교
| 항목 | v1 | v2 |
|------|:--:|:--:|
| 소스 파일 | ~22개 | ~40개 |
| 코드 라인 | ~4,000 | ~8,000+ |
| 탭 수 | 5개 | 7개 |
| lib 파일 | 6개 | 20개 |
| CSS | ~26KB | ~33KB |

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
