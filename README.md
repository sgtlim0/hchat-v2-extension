# H Chat v5 Extension

멀티 AI 프로바이더 Chrome 올인원 어시스턴트 확장 프로그램

## Overview

H Chat은 Sider 스타일의 올인원 AI 브라우저 어시스턴트입니다. AWS Bedrock Claude, OpenAI GPT, Google Gemini를 통합 지원하며, 20개 내장 비서 마켓플레이스, AI 가드레일(PII 감지/마스킹), PPT 기획, 비서 토론, 대화 템플릿, 문서 번역/작성, PPTX/PDF 번역, 템플릿 문서 작성, 이미지 생성, 크로스 모델 토론, YouTube 분석, PDF 채팅, 검색 엔진 AI 카드, 글쓰기 어시스턴트 등 풍부한 기능을 제공합니다.

- **Version**: 5.0.0
- **Platform**: Chrome Extension (Manifest V3)
- **AI Providers**: AWS Bedrock (Claude), OpenAI (GPT), Google Gemini
- **GitHub**: https://github.com/sgtlim0/hchat-v2-extension
- **Vercel**: https://hchat-v2-extension.vercel.app/sidepanel.html

## Features

### 1. 멀티 AI 프로바이더 시스템
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

### 4. 크로스 모델 토론 - 3라운드 토론 엔진: 초기 답변 → 상호 비평 → 종합
- 서로 다른 AI 모델 간 토론 진행
- **비서 vs 비서 토론**: 커스텀 비서의 관점(systemPrompt)으로 토론 참가 (v5.0)
- 토론 기록 시각화
- 최종 합의 도출

### 5. YouTube 콘텐츠 분석

| 기능 | 설명 |
|------|------|
| 자막 요약 | 3단계 fallback으로 자막 추출 + AI 요약 |
| 댓글 분석 | 최대 200개 댓글 추출, 감정 분석, 토픽 추출, 인사이트 도출 |
| 통합 리포트 | 자막 + 댓글 종합 분석 Markdown 리포트 생성 |

### 6. PDF 채팅

- pdfjs-dist를 이용한 PDF 텍스트 추출
- PDF 내용 기반 질의응답
- 페이지별 컨텍스트 추적

### 7. 검색 엔진 AI 카드

- Google, Bing, Naver 검색 결과에 AI 요약 카드 주입
- 검색 쿼리 자동 감지 및 AI 답변 생성
- 접을 수 있는 카드 UI, 전체 채팅 열기 지원

### 8. 글쓰기 어시스턴트

- 웹페이지의 모든 textarea에 플로팅 툴바 추가
- 7가지 변환: 개선, 축약, 확장, 전문적, 캐주얼, 교정, 번역
- 실시간 AI 변환 결과 적용

### 9. 도구 패널 (ToolsView) — 17개 AI 도구
| 도구 | 기능 |
|------|------|
| 📄 페이지 요약 | 현재 탭 내용 추출 + AI 요약 |
| 📑 멀티 탭 요약 | 열린 탭 동시 요약 (최대 10개) |
| ▶️ YouTube 분석 | 자막/댓글 분석, 통합 리포트 |
| 🌐 번역 | 50개 언어 지원 |
| ✏️ 글쓰기 도구 | 11가지 텍스트 변환 |
| ✅ 문법 교정 | AI 맞춤법/문법 교정 |
| 📸 OCR | 이미지 → 텍스트 추출 (Vision) |
| 📸 배치 OCR | 최대 10장 동시 처리, 4가지 모드 (일반/명함/영수증/스크린샷) |
| 📄 PDF 채팅 | PDF 업로드 후 질의응답 |
| 📊 데이터 분석 | CSV/Excel 업로드 → 요약 통계/트렌드/이상치 분석 |
| 🔬 딥 리서치 | 3단계 자동 리서치 (쿼리 생성 → 검색 → 리포트) |
| 📝 문서 번역 | TXT/CSV/XLSX/PPTX/PDF 파일 번역, 포맷 유지, 청크 분할, 중단 기능, 진행 상황 표시 (경과 시간 + 예상 남은 시간) |
| 📋 문서 작성 | 5가지 문서 유형 AI 생성, 프로젝트 관리 (검색+필터), Markdown/DOCX 내보내기 |
| 🎨 이미지 생성 | DALL-E 3 (3가지 크기, Standard/HD, Vivid/Natural) |
| 📋 템플릿 문서 | DOCX 템플릿 업로드 → {{필드}} 추출 → AI 내용 생성, 갤러리 저장/재사용, 템플릿 내보내기/가져오기 (JSON) |
| 📊 PPT 기획 | 주제 입력 → AI 슬라이드 목차/콘텐츠 생성 → PPTX 다운로드 (v5.0) |
| 🔎 페이지 검색 | 현재 페이지 내용 검색 |

### 10. 웹 검색 + RAG
- **DuckDuckGo**: API 키 없이 HTML 파싱
- **Google Custom Search**: API 키 설정 시 사용
- **자동 감지**: 질문 패턴으로 검색 필요 여부 자동 판단
- **RAG**: 검색 결과를 시스템 프롬프트에 주입
- **캐시**: 쿼리별 1시간 캐시

### 11. 멀티턴 에이전트 + 플러그인 시스템

- XML 기반 도구 호출 (`<tool_call>...</tool_call>`)
- 8가지 내장 도구:
  - `web_search`: 실시간 웹 검색
  - `read_page`: 현재 페이지 내용 읽기
  - `fetch_url`: 임의 URL 페치
  - `calculate`: 수학 계산 (safeEvalMath 샌드박스)
  - `get_datetime`: 현재 날짜/시간
  - `translate`: 텍스트 번역
  - `summarize_text`: 텍스트 요약
  - `timestamp_convert`: Unix ↔ 날짜 변환
- **커스텀 플러그인** (v3.6 신규):
  - Webhook: 외부 URL 호출 (GET/POST)
  - JavaScript: 안전한 JS 스니펫 실행
  - Prompt: 템플릿 기반 입력 변환 (`{{input}}`)
  - 플러그인 관리 UI (SettingsView에서 접근)
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

- 역색인 + trigram 기반 퍼지 매칭 (한국어 부분 일치)
- `Ctrl+Shift+F` 모달
- 1000 대화 검색 < 100ms
- 증분 인덱스 업데이트 (메시지 추가/삭제 시 자동)
- 관련도 랭킹: TF × 0.7 + 최신성 × 0.3

### 17. Thinking Depth 제어

- **Fast**: 빠른 응답, thinking 비활성화 (maxTokens 1024 제한)
- **Normal**: 기본 응답 모드
- **Deep**: Claude Extended Thinking 활성화 (budget_tokens 10000)
- 모델별 지원 여부 자동 감지 (Sonnet/Opus만 Deep 지원)
- Deep 모드 토큰 2-3배 증가 경고

### 18. 딥 리서치 모드

- 3단계 자동 리서치 파이프라인:
  1. AI가 검색 쿼리 3-5개 자동 생성
  2. DuckDuckGo API로 각 쿼리 검색 (최대 15개 소스)
  3. 수집된 소스 기반 구조화된 리포트 작성
- 실시간 진행 상황 표시 (스텝별 아이콘 + 프로그레스 바)
- 채팅 입력창 하단 🔬 토글로 활성화/비활성화

### 19. 데이터 분석 도구

- CSV/Excel 파일 업로드 후 AI 분석
- 3가지 분석 유형: 요약 통계, 트렌드 분석, 이상치 탐지
- xlsx 라이브러리 동적 임포트 (lazy loading, 번들 최적화)
- 마크다운 테이블 미리보기

### 20. 사용량 알림 + Webhook

- 월간 예산 설정 (USD)
- 경고/위험 임계치 설정 (기본 70%/90%)
- 채팅 상단 배너로 실시간 사용량 알림 (프로그레스 바 포함)
- **Webhook 알림** (v3.5 신규):
  - Slack, Discord, 일반 Webhook URL 자동 감지
  - 포맷별 페이로드 (Slack Blocks, Discord Embeds, Generic JSON)
  - 일일 중복 방지 (같은 날 같은 레벨 1회만 전송)

### 21. 사용량 추적

- 토큰 추정 (한국어: 2자/토큰)
- 프로바이더별 비용 추정 (AWS, OpenAI, Google 개별 가격)
- 기능별 사용량 (채팅/그룹/도구/에이전트/토론/리포트)
- 일별 비용 차트
- 90일 보존

### 22. 프롬프트 라이브러리
- 8개 기본 프롬프트 (요약, 번역, 교정, 코드 리뷰, 이메일 등)
- 커스텀 프롬프트 생성/편집/삭제
- 단축어 지원 (예: `/sum`)
- 변수 치환 (`{{content}}`)
- 가져오기/내보내기 (JSON)

### 23. 다국어 지원 (i18n)
- 한국어/영어/일본어 3개 언어 지원
- 경량 자체 구현 (외부 라이브러리 미사용, 720+ 키/언어)
- `t()` 함수 + `useLocale()` React 훅
- Content Script용 `tSync()` + `getLocale()` 비동기 패턴
- 설정 탭에서 언어 선택 (즉시 반영)

### 24. 비서 마켓플레이스 (v5.0 확장)
- **비서 빌더**: 모델 + 시스템 프롬프트 + 도구 + 파라미터를 패키지로 묶어 관리
- **20개 내장 비서**: 6개 카테고리 (번역/문서/분석/코드/작문/기타)
  - 기존: 문서 검토관, 번역 전문가, 데이터 분석가, 이메일 작성, 코드 리뷰어, 보고서 작성, 회의록 정리, 리서치 비서
  - 신규: 기술 문서, 마케팅 카피, 법률 검토, API 문서, SQL 도우미, 프론트엔드, 시장 분석, 재무 분석, 일본어 번역, 중국어 번역, 학술 논문, 프레젠테이션 기획
- **카테고리 필터** + **검색** + **인기순 정렬**
- **내보내기/가져오기**: JSON 형식, 중복 이름 자동 스킵
- 사용자 커스텀 비서 생성/편집/삭제
- 비서별 사용 횟수 추적

### 25. AI 가드레일 (v5.0 신규)
- 사용자 입력에서 개인정보(PII) 자동 감지
- 5가지 PII 타입: 이메일, 전화번호, 주민등록번호, 카드번호, 계좌번호
- 감지 시 경고 배너 + 3가지 선택: 마스킹 후 전송 / 그대로 전송 / 취소
- 설정에서 감지 유형별 on/off 가능

### 26. 대화 템플릿 (v5.0 신규)
- 자주 쓰는 다단계 대화 흐름을 템플릿으로 저장/재사용
- `{{변수}}` 플레이스홀더 지원 → 실행 시 변수 입력
- 단계별 role (user/system) + AI 응답 대기 옵션
- 내보내기/가져오기 (JSON), 최대 20개, 사용 횟수 추적

### 27. 콘텐츠 스크립트 플로팅 툴바

텍스트 선택 시 7가지 동작:
- 💡 설명 | 🌐 번역 | 📄 요약 | ✏️ 재작성 | 🎩 격식체 | ✅ 문법 | 🖍️ 하이라이트

### 28. 대화 관리 (HistoryView)
- 검색, 태그 필터
- 대화 고정 (핀)
- 대화 폴더 분류
- 삭제 (확인)
- 태그 관리
- 포크 인디케이터

### 29. 멀티 탭 요약
- 현재 창의 모든 탭 (최대 10개) 동시 요약
- 탭별 핵심 내용 + 전체 공통 주제 분석

### 30. 음성 대화 모드

- STT → AI → TTS 연속 루프
- Web Speech API 활용
- **SVG 파형 시각화** (VoiceWaveform.tsx, 8-bar animated)
- 음성 모드 중 입력 비활성화 + 펄스 마이크 인디케이터
- 음성 모드 배지 표시

### 31. 대화 가져오기/내보내기

- **ChatGPT JSON 가져오기**: mapping 구조 자동 파싱
- **Claude JSON 가져오기**: chat_messages 배열 파싱
- H Chat 네이티브 형식 (단일/배열/wrapped)
- 소스 자동 감지 (detectSource)
- **배치 가져오기**: Storage.setMultiple()로 대량 성능 최적화
- 5가지 내보내기: Markdown, HTML, JSON, TXT, PDF

### 32. 오프라인 지원 (v3.6 신규)
- 네트워크 상태 감지 (`useNetworkStatus` 훅)
- 오프라인 시 메시지 큐 (`messageQueue.ts`, FIFO)
- 재연결 시 큐 자동 처리 (`processQueue`)
- 상태 배너: 오프라인(주황) / 재연결(초록, 3초 자동 숨김)
- 큐 카운트 표시 ("N개 메시지 대기 중")

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
| i18n | 자체 구현 (t, useLocale, tSync) | - |
| 폰트 | IBM Plex Sans KR + IBM Plex Mono | - |
| 스타일 | CSS Variables (Dark) | - |

## Supported Models

### AWS Bedrock (Claude)
| Label | Model ID | 용도 | 비용 (1M tokens) |
|-------|----------|------|-----------------|
| Claude Sonnet 4.6 (권장) | `us.anthropic.claude-sonnet-4-6` | 기본 모델 | $3 / $15 |
| Claude Opus 4.6 (최고 성능) | `us.anthropic.claude-opus-4-6-v1` | 최고 추론 성능 | $15 / $75 |
| Claude Haiku 4.5 (빠름) | `us.anthropic.claude-haiku-4-5-20251001-v1:0` | 빠른 응답 | $0.8 / $4 |

### OpenAI
| Label | Model ID | 용도 |
|-------|----------|------|
| GPT-4o (멀티모달) | `gpt-4o` | 코드 생성, 기술 작업 |
| GPT-4o mini (빠름) | `gpt-4o-mini` | 빠르고 경제적 |

### Google Gemini
| Label | Model ID | 용도 |
|-------|----------|------|
| Gemini Flash 2.0 (초고속) | `gemini-2.0-flash-exp` | 초고속 응답 |
| Gemini Pro 1.5 (고급) | `gemini-1.5-pro` | 긴 컨텍스트, 복잡한 작업 |

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
│   ├── additional-features-design.md  # 기능 로드맵
│   ├── competitive-analysis.md        # 경쟁사 분석 & 기능 갭
│   ├── feature-design-inspired.md     # 경쟁사 영감 기능 설계서
│   ├── implementation-plan-features.md # 기능 구현 계획서
│   └── roadmap.md                     # 향후 로드맵 (v4.3~v5.0)
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
    │   ├── search-injector.ts     # 검색 엔진 AI 카드 주입
    │   └── writing-assistant.ts   # Textarea 글쓰기 툴바
    │       ├── 7가지 텍스트 선택 동작
    │       ├── Bedrock 스트리밍 (Background Port)
    │       └── 결과 패널 (복사/채팅 계속)
    ├── sidepanel/
    │   ├── App.tsx                 # 메인 앱 (8탭 UI, 167줄)
    │   └── main.tsx               # React 마운트
    ├── popup/
    │   ├── PopupApp.tsx            # 빠른 실행기
    │   └── main.tsx               # React 마운트
    ├── i18n/
    │   ├── index.ts               # t(), useLocale(), tSync(), getLocale()
    │   ├── ko.ts                  # 한국어 번역 (720+ 키)
    │   ├── en.ts                  # 영어 번역 (720+ 키)
    │   └── ja.ts                  # 일본어 번역 (720+ 키)
    ├── components/                 # 57개 컴포넌트 (테스트 포함)
    │   ├── ChatView.tsx            # 메인 채팅 (460줄)
    │   ├── GroupChatView.tsx       # 크로스 모델 비교
    │   ├── DebateView.tsx          # 크로스 모델 토론
    │   ├── ToolsView.tsx           # 도구 패널 (17개 도구, 230줄)
    │   ├── ChatTemplatePanel.tsx  # 대화 템플릿 패널 (v5.0)
    │   ├── PromptLibraryView.tsx   # 프롬프트 라이브러리
    │   ├── HistoryView.tsx         # 대화 기록
    │   ├── BookmarksView.tsx       # 하이라이트 관리
    │   ├── SettingsView.tsx        # 설정 (다중 프로바이더)
    │   ├── UsageView.tsx           # 사용량 대시보드
    │   ├── MessageSearchModal.tsx  # 메시지 검색
    │   ├── ModelSelector.tsx       # 모델 드롭다운
    │   ├── AssistantSelector.tsx   # 커스텀 비서 선택
    │   ├── OfflineBanner.tsx       # 오프라인 상태 배너
    │   ├── PluginManagerView.tsx   # 플러그인 관리 UI
    │   ├── StorageManagement.tsx   # 스토리지 관리 UI
    │   ├── DataChart.tsx           # 데이터 차트 시각화
    │   ├── ErrorBoundary.tsx       # React 에러 경계
    │   ├── UsageChart.tsx          # 사용량 차트
    │   ├── chat/                   # ChatView 서브 컴포넌트 (15개 파일)
    │   │   ├── MsgBubble.tsx       # 메시지 버블
    │   │   ├── ChatToolbar.tsx     # 상단 툴바
    │   │   ├── ChatInputArea.tsx   # 입력 영역
    │   │   ├── CodeBlock.tsx       # 코드 블록 렌더링
    │   │   ├── MarkdownRenderer.tsx # 마크다운 렌더링
    │   │   ├── SearchSources.tsx   # 웹 검색 소스 표시
    │   │   ├── AgentStepsView.tsx  # 에이전트 스텝 시각화
    │   │   ├── SummaryPanel.tsx    # 대화 요약 패널
    │   │   ├── PinnedPanel.tsx     # 고정 메시지 패널
    │   │   ├── ThinkingDepthSelector.tsx  # 사고 깊이 선택
    │   │   ├── DeepResearchToggle.tsx     # 딥 리서치 토글
    │   │   ├── UsageAlertBanner.tsx       # 사용량 알림 배너
    │   │   ├── VoiceWaveform.tsx          # 음성 파형 SVG
    │   │   └── index.ts            # 서브 컴포넌트 export
    │   └── tools/                  # 도구 서브 컴포넌트 (20개 파일)
    │       ├── SummarizeTool.tsx   # 페이지 요약
    │       ├── MultiTabTool.tsx    # 멀티 탭 요약
    │       ├── YouTubeTool.tsx     # YouTube 자막/댓글 분석
    │       ├── CommentsTool.tsx    # 댓글 분석
    │       ├── InsightTool.tsx     # 통합 리포트
    │       ├── TranslateTool.tsx   # 번역
    │       ├── WriteTool.tsx       # 글쓰기 도구
    │       ├── GrammarTool.tsx     # 문법 교정
    │       ├── OcrTool.tsx         # OCR
    │       ├── BatchOcrTool.tsx    # 배치 OCR (10장, 4모드)
    │       ├── PdfTool.tsx         # PDF 채팅
    │       ├── DataAnalysisTool.tsx # 데이터 분석
    │       ├── DocTranslateTool.tsx # 문서 번역 (TXT/CSV/XLSX/PPTX/PDF)
    │       ├── DocWriteTool.tsx    # 문서 작성 (5유형, 프로젝트 관리, DOCX)
    │       ├── DocProjectList.tsx  # 문서 프로젝트 목록
    │       ├── DocProjectDetail.tsx # 문서 프로젝트 상세 + 버전 관리
    │       ├── DocTemplateTool.tsx # 템플릿 문서 작성 (DOCX 업로드 → AI 생성)
    │       ├── ImageGenTool.tsx    # 이미지 생성 (DALL-E 3)
    │       ├── PptxPlanTool.tsx    # PPT 기획 (v5.0)
    │       └── types.ts            # 도구 타입 정의
    ├── hooks/
    │   ├── useChat.ts              # 채팅 상태 + 스트리밍 (256줄)
    │   ├── useConfig.ts            # 설정 관리 (62줄)
    │   ├── useNetworkStatus.ts     # 네트워크 상태 감지
    │   ├── useProvider.ts          # 프로바이더 인스턴스, 모델 리스트
    │   └── useShortcuts.ts         # 키보드 단축키 (40줄)
    ├── lib/                        # 56개 모듈 (테스트 제외 92개 파일)
    │   ├── providers/
    │   │   ├── types.ts            # AIProvider 인터페이스, ModelDef
    │   │   ├── bedrock-provider.ts # AWS Bedrock Claude 프로바이더
    │   │   ├── openai-provider.ts  # OpenAI GPT 프로바이더
    │   │   ├── gemini-provider.ts  # Google Gemini 프로바이더
    │   │   ├── provider-factory.ts # 프로바이더 생성, 모델 탐색
    │   │   └── model-router.ts     # 자동 모델 라우팅
    │   ├── aws-sigv4.ts            # AWS SigV4 서명 (Web Crypto)
    │   ├── chatHistory.ts          # 대화 CRUD + 인덱스
    │   ├── agent.ts                # 멀티턴 에이전트
    │   ├── agentTools.ts           # 내장 도구 8개
    │   ├── webSearch.ts            # DuckDuckGo + Google
    │   ├── searchIntent.ts         # 검색 의도 감지
    │   ├── bookmarks.ts            # 하이라이트 CRUD
    │   ├── shortcuts.ts            # 키보드 단축키
    │   ├── pageContext.ts          # 페이지 컨텍스트
    │   ├── pageReader.ts           # 콘텐츠 추출 + YouTube 자막
    │   ├── commentAnalyzer.ts      # YouTube 댓글 분석
    │   ├── pdfParser.ts            # PDF 텍스트 추출 (pdfjs-dist)
    │   ├── insightReport.ts        # YouTube 통합 리포트
    │   ├── debate.ts               # 크로스 모델 토론 엔진
    │   ├── exportChat.ts           # 4형식 내보내기
    │   ├── importChat.ts           # JSON 가져오기
    │   ├── messageSearch.ts        # 전체 텍스트 검색
    │   ├── usage.ts                # 토큰/비용 추적 (프로바이더별)
    │   ├── promptLibrary.ts        # 프롬프트 템플릿
    │   ├── personas.ts             # 페르소나 프리셋
    │   ├── summarize.ts            # 페이지 요약 + 캐시
    │   ├── writingTools.ts         # 7가지 글쓰기 액션
    │   ├── tags.ts                 # 대화 태그 관리
    │   ├── storage.ts              # chrome.storage 래퍼
    │   ├── stt.ts                  # Speech-to-Text (Web Speech API)
    │   ├── tts.ts                  # Text-to-Speech (Web Speech API)
    │   ├── dataAnalysis.ts         # CSV/Excel 파싱 + 분석 프롬프트
    │   ├── deepResearch.ts         # 딥 리서치 오케스트레이션
    │   ├── usageAlert.ts           # 사용량 알림 + Webhook
    │   ├── folders.ts              # 대화 폴더 관리
    │   ├── pluginRegistry.ts       # 커스텀 플러그인 레지스트리
    │   ├── messageQueue.ts         # 오프라인 메시지 큐
    │   ├── storageManager.ts       # 스토리지 관리 + 정리
    │   ├── detectLanguage.ts       # 언어 자동 감지
    │   ├── assistantBuilder.ts     # 커스텀 비서 CRUD
    │   ├── batchOcr.ts             # 배치 OCR 오케스트레이터
    │   ├── docTranslator.ts        # 문서 번역 파이프라인 (TXT/CSV/XLSX/PPTX/PDF)
    │   ├── docGenerator.ts         # AI 문서 생성 엔진
    │   ├── docProjects.ts          # 문서 프로젝트 CRUD + 버전 관리
    │   ├── docTemplateParser.ts    # DOCX 템플릿 파싱, {{필드}} 추출
    │   ├── docTemplateGenerator.ts # 템플릿 AI 필드 제안 + 섹션 생성
    │   ├── docTemplateStore.ts     # 템플릿 갤러리 CRUD, Base64 인코딩, export/import
    │   ├── timeFormat.ts           # 시간 포맷팅 (ko/en/ja), ETA 계산
    │   ├── pptxParser.ts           # PPTX 파싱/재조립 (JSZip)
    │   ├── imageGenerator.ts       # DALL-E 3 이미지 생성
    │   ├── chartDataExtractor.ts   # 차트 데이터 자동 추출
    │   ├── pptxGenerator.ts        # PPTX 생성 (JSZip, v5.0)
    │   ├── guardrail.ts            # PII 감지/마스킹 (v5.0)
    │   ├── chatTemplates.ts        # 대화 템플릿 CRUD (v5.0)
    │   └── README.md               # lib 문서
    └── styles/
        └── global.css              # 디자인 시스템 (~40KB)
```

## Architecture

### 전체 아키텍처

```
┌─────────────────────────────────────────────────┐
│                  Chrome Browser                  │
├──────────┬──────────┬──────────┬────────────────┤
│ Side     │ Popup    │ Content  │ Background     │
│ Panel    │          │ Script   │ Service Worker │
│ (8 tabs) │ (launch) │ (toolbar)│ (alarms, ctx)  │
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
    └──→ provider.stream() → SigV4 서명 → Bedrock API
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
| `hchat:plugins` | Plugin[] | 커스텀 플러그인 정의 |
| `hchat:message-queue` | QueueItem[] | 오프라인 메시지 큐 |
| `hchat:folders` | Folder[] | 대화 폴더 |
| `hchat:assistants` | Assistant[] | 커스텀 비서 정의 |
| `hchat:active-assistant` | string | 현재 활성 비서 ID |
| `hchat:doc-projects` | DocProjectIndex[] | 문서 프로젝트 인덱스 |
| `hchat:doc-project:{id}` | DocProject | 개별 문서 프로젝트 + 버전 |
| `hchat:doc-templates` | DocTemplate[] | 템플릿 갤러리 (Base64 DOCX 파일) |
| `hchat:chat-templates` | ChatTemplate[] | 대화 템플릿 (v5.0) |
| `hchat:guardrail-config` | GuardrailConfig | PII 가드레일 설정 (v5.0) |

## Manifest Permissions

| 권한 | 용도 |
|------|------|
| `storage` | 대화 기록, 설정, 하이라이트, 사용량, 플러그인, 큐 |
| `sidePanel` | 사이드패널 API |
| `contextMenus` | 우클릭 메뉴 (설명, 번역, 요약, 재작성) |
| `activeTab` | 현재 탭 콘텐츠 접근 |
| `scripting` | executeScript (페이지 컨텍스트, YouTube) |
| `tabs` | 탭 관리 |

**Host Permissions**:
- `<all_urls>` — AI API 통신 + 콘텐츠 스크립트 주입

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

### v5.0.0 (2026-03-05) — UX 고도화 + 기술 부채 정리

| 기능 | 설명 |
|------|------|
| 비서 마켓플레이스 | 내장 비서 8→20개 확장, 6개 카테고리 필터, 검색, 인기순 정렬, JSON 내보내기/가져오기 |
| PPT 기획 도구 | 주제 입력 → AI 목차 생성 → 슬라이드별 콘텐츠 → PPTX 다운로드 (17번째 도구) |
| AI 가드레일 | PII 자동 감지 (이메일/전화/주민번호/카드/계좌), 마스킹 후 전송, 경고 배너 |
| 비서 vs 비서 토론 | 토론 참가자에 커스텀 비서 연동, 비서 systemPrompt 주입 |
| 대화 템플릿 | 다단계 대화 흐름 저장/재사용, {{변수}} 치환, JSON 내보내기/가져오기 |
| 기술 부채 정리 | PersonaSelector.tsx 삭제, CSS 변수 정리 (7개 제거), i18n 키 정리 (10개 제거) |
| 통계 | 17개 AI 도구, 20개 내장 비서, 57개 컴포넌트, 56개 lib 파일 |
| 품질 | 741 tests (40 files), 720+ i18n 키 (ko/en/ja), ESLint 0 errors |

### v4.5.0 (2026-03) — 추가 UX 개선

| 기능 | 설명 |
|------|------|
| 번역 진행 상황 표시 | timeFormat.ts 유틸리티, 경과 시간 + 예상 남은 시간 표시, performance.now() 기반 청크 타이밍 |
| 템플릿 갤러리 공유 | 템플릿 내보내기/가져오기 (JSON 포맷 버전 1), 중복 건너뛰기, 최대 10개 제한 |
| 도구 | 16개 도구, 649 tests (36 files), 670+ i18n 키 (ko/en/ja) |

### v4.4.0 (2026-03) — UX 개선

| 기능 | 설명 |
|------|------|
| 문서 번역 중단 | AbortSignal 기반 청크별 번역 중단, 부분 결과 보존 |
| 프로젝트 검색 + 필터 | 문서 프로젝트 제목/내용 검색, 타입별 필터 칩 (보고서/이메일/제안서/회의록/메모) |
| 템플릿 갤러리 | DOCX 템플릿 로컬 저장/관리, Base64 인코딩, 갤러리 탭에서 재사용 |
| 도구 | 16개 도구, 620 tests (35 files), 660+ i18n 키 (ko/en/ja) |

### v4.3.0 (2026-03) — 문서 도구 확장

| 기능 | 설명 |
|------|------|
| PPTX/PDF 번역 | PPTX: JSZip 파싱 → XML 텍스트 번역 → 재조립, PDF: 텍스트 추출 → Markdown 번역 |
| 문서 프로젝트 관리 | 프로젝트 CRUD, 버전 관리 (최대 10), 프로젝트 저장/열기/복원 |
| 템플릿 문서 작성 | DOCX 업로드 → {{필드}} 추출 → AI 제안 → 섹션별 AI 생성 → MD/DOCX 다운로드 |
| 도구 확장 | 16개 도구 (템플릿 문서 추가), 589 tests (34 files) |

### v4.2.0 (2026-03) — 문서 도구 + 이미지 생성

| 기능 | 설명 |
|------|------|
| 문서 번역 | TXT/CSV/XLSX 파일 번역, 포맷 유지, 1000자 청크 분할 + 용어 일관성 |
| 문서 작성 | 5가지 문서 유형 (보고서/이메일/제안서/회의록/메모), 목차→본문 생성, Markdown/DOCX |
| 이미지 생성 | DALL-E 3 API, 3가지 크기, Standard/HD 품질, 비용 추정, 세션 히스토리 |
| ToolsView 확장 | 15개 도구, 도구별 서브 컴포넌트 분리 (tools/ 디렉토리) |

### v4.0.0 (2026-03) — 커스텀 비서 빌더 + 배치 OCR

| 기능 | 설명 |
|------|------|
| 커스텀 비서 빌더 | 모델+프롬프트+도구+파라미터 패키지, 8개 내장 비서, CRUD, 사용 횟수 추적 |
| AssistantSelector | PersonaSelector 대체, 비서별 자동 설정 (useChat 연동) |
| 배치 OCR | 최대 10장 동시, 드래그&드롭, 4모드 (일반/명함/영수증/스크린샷), 구조화 JSON |
| TXT/JSON 내보내기 | OCR 결과 파일 다운로드 |

### v3.6.0 (2026-03) — 오프라인 지원 + 플러그인 시스템

| 기능 | 설명 |
|------|------|
| 오프라인 지원 | 네트워크 감지, 메시지 큐, 재연결 시 자동 전송 |
| 플러그인 시스템 | Webhook/JS/Prompt 커스텀 도구, 에이전트 모드 통합 |
| 내장 도구 확장 | translate, summarize_text, timestamp_convert 3개 추가 |
| 플러그인 관리 UI | SettingsView에서 CRUD, enable/disable, React.lazy 분리 |

### v3.5.0 (2026-03) — 6대 기능 확장

| 기능 | 설명 |
|------|------|
| 검색 인덱싱 | 역색인 + trigram 퍼지매칭, <100ms/1000 대화 |
| 음성 UX | SVG 파형, 입력 비활성화, 펄스 인디케이터 |
| 일본어 i18n | 484+ 키, 3개 언어 지원 (ko/en/ja) |
| Webhook 알림 | Slack/Discord/generic, 일일 중복 방지 |
| 가져오기 고도화 | ChatGPT/Claude JSON 파서, 배치 import |
| Chrome Web Store | 배포 가이드, 프라이버시 정책 |

### v3.4.0 (2026-03) — 스트리밍 & 차트

| 기능 | 설명 |
|------|------|
| 딥 리서치 스트리밍 | AsyncGenerator, Google CSE 지원, 중간 결과 표시 |
| 데이터 분석 차트 | chartDataExtractor + DataChart SVG (bar/line) |
| v3.pen 디자인 | PromptLibrary, ErrorBoundary, WritingAssistant 화면 추가 |

### v3.3.0 (2026-03) — 기술 부채 해소

| 기능 | 설명 |
|------|------|
| models.ts 제거 | provider.stream() 직접 사용, 레거시 코드 삭제 |
| CSP 호환 | toolbar/writing-assistant Shadow DOM 격리 |
| MV3 권한 최소화 | alarms/notifications 제거 |
| 스트리밍 에러 복구 | streamWithRetry() (자동 재시도 2회) |
| 사용량 SVG 차트 | UsageChart.tsx (일별 비용 시각화) |

### v3.1.0 (2026-03) — 경쟁사 영감 기능 + 품질 개선

#### v3.1에서 추가 (주요 기능)
| 기능 | 설명 |
|------|------|
| Thinking Depth 제어 | Fast/Normal/Deep 3단계, Claude Extended Thinking 지원 |
| 딥 리서치 모드 | 3단계 자동 리서치 (쿼리 생성 → 검색 → 리포트) |
| 데이터 분석 | CSV/Excel 업로드 → AI 분석 (요약/트렌드/이상치) |
| 사용량 알림 | 월간 예산 설정, 경고/위험 배너 |
| 멀티 탭 요약 | 열린 탭 동시 요약 (최대 10개) |
| 음성 대화 모드 | STT → AI → TTS 연속 루프 |
| 대화 폴더 | 대화 폴더 분류 기능 |
| 프롬프트 가져오기/내보내기 | JSON 형식 프롬프트 이동 |
| 사용량 CSV 내보내기 | 일별 비용 CSV 다운로드 |
| 라이트 테마 | 시스템/다크/라이트 테마 전환 |

#### v3.1 코드 품질 개선
| 항목 | 내용 |
|------|------|
| 테스트 | 498개 테스트 (30 파일), Vitest + React Testing Library |
| ESLint | flat config, 0 errors |
| ChatView 리팩토링 | 715줄 → 460줄 (8개 서브 컴포넌트 추출) |
| i18n | 한국어/영어/일본어 600+ 키, AI 프롬프트 다국어 |
| 보안 | safeEvalMath (에이전트 JS eval 샌드박스) |
| 성능 | React.lazy 코드 스플리팅, xlsx 동적 임포트 |
| 스토리지 관리 | 고아 데이터 정리, 90일 이전 대화 삭제 |

#### v5.0 기술 부채 정리 (2026-03-05)
| 항목 | 내용 |
|------|------|
| 컴포넌트 정리 | PersonaSelector.tsx 삭제 (AssistantSelector로 대체됨) |
| CSS 변수 정리 | 미사용 7개 제거 (--radius-lg, --color-bedrock/openai/gemini, --green, --border3, --accent-glow) |
| i18n 키 정리 | model 블록(2개) + promptDefaults 블록(8개) = 10개 제거, 730+ → 720+ 키 |
| 코드베이스 | 57개 컴포넌트, 56개 lib 파일 (테스트 제외), 741 tests (40 files) |

### v3.0.0 (2026-03) — 멀티 AI 프로바이더 시스템

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
| 다국어 지원 (i18n) | 한국어/영어/일본어 3개 언어 전환, 경량 자체 구현 (t() + useLocale()) |

### v2.0.0 (2025-12) — 웹 검색 + 에이전트 시스템

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
| 항목 | v1 | v2 | v3 | v3.6 | v4.2 | v4.3 | v4.5 | v5.0 |
|------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| 소스 파일 | ~22개 | ~40개 | ~50개 | ~80개 | ~90개 | ~100개 | ~107개 | ~115개 |
| 코드 라인 | ~4,000 | ~8,000 | ~10,000+ | ~15,000+ | ~18,000+ | ~20,000+ | ~21,500+ | ~25,000+ |
| 탭 수 | 5개 | 7개 | 8개 | 8개 | 8개 | 8개 | 8개 | 8개 |
| 컴포넌트 (.tsx) | 12개 | 18개 | 24개 | 40개 | 48개 | 54개 | 58개 | 57개 |
| lib 파일 | 6개 | 20개 | 30개 | 45개 | 50개 | 55개 | 57개 | 56개 |
| AI 프로바이더 | 1개 | 1개 | 3개 | 3개 | 3개 | 3개 | 3개 | 3개 |
| 지원 모델 | 3개 | 3개 | 9개 | 9개 | 9개 | 9개 | 9개 | 9개 |
| 도구 | 4개 | 8개 | 8개 | 12개 | 15개 | 16개 | 16개 | 17개 |
| 내장 비서 | 0개 | 0개 | 0개 | 0개 | 0개 | 0개 | 8개 | 20개 |
| 테스트 | 0개 | 0개 | 0개 | 365개 | 498개 (30 파일) | 589개 (34 파일) | 649개 (36 파일) | 741개 (40 파일) |
| i18n 키 | 0개 | 0개 | 0개 | 420+ (ko/en) | 600+ (ko/en/ja) | 650+ (ko/en/ja) | 670+ (ko/en/ja) | 720+ (ko/en/ja) |

## Design System

### 색상 (Dark 테마 기본)

Dark Obsidian 테마, Emerald accent, 26개 CSS 변수 (dark), 18개 재정의 (light)

| 토큰 | Dark | Light |
|------|------|-------|
| Background (0-5) | `#080b0e ~ #2a3a52` | `#ffffff ~ #c0c5cd` |
| Text (0-3) | `#eef1f5 ~ #3d4f65` | `#1a1a2e ~ #a0aec0` |
| Accent | `#34d399` (Emerald) | `#059669` |
| Border | `rgba(255,255,255,0.06/0.1)` | `rgba(0,0,0,0.08/0.12)` |
| Utility | `#a78bfa` (purple), `#60a5fa` (blue), `#fbbf24` (amber), `#f87171` (red) | 동일 |

### 타이포그래피
- **Sans**: IBM Plex Sans KR (300-700)
- **Mono**: IBM Plex Mono (300-600)
- **본문**: 13px, line-height 1.6
- **Radius**: 10px (default), 6px (small)

## Security

- AWS 자격증명: `chrome.storage.local` 전용 (동기화/외부 전송 없음)
- AWS Bedrock 직접 통신 (HTTPS, SigV4 서명)
- 모든 데이터 로컬 저장 (텔레메트리, 분석 없음)
- 콘텐츠 스크립트: 격리된 world에서 실행
- JavaScript eval 도구: 페이지 컨텍스트에서 샌드박스 실행

## License

Private
