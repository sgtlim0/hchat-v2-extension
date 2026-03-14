# H Chat v6.0 Extension

Multi-AI Provider Chrome All-in-One Assistant Extension

## Overview

H Chat은 Sider 스타일의 올인원 AI 브라우저 어시스턴트입니다. AWS Bedrock Claude, OpenAI GPT, Google Gemini, Ollama (로컬 LLM), OpenRouter (100+ 모델)을 통합 지원하며, AI 메모리 시스템, 워크플로우 빌더, 대화 분석 대시보드, MCP 서버 연동, 팀 공유, 감사 로그, 정책 관리, 20개 내장 비서 마켓플레이스, AI 가드레일(PII 감지/마스킹), 비서 체인, PPT 기획, 크로스 모델 토론(투표), 대화 템플릿, 문서 번역/작성, 이미지 생성, YouTube 분석, PDF 채팅, 검색 엔진 AI 카드, 글쓰기 어시스턴트 등 풍부한 기능을 제공합니다.

- **Version**: 6.0.0
- **Platform**: Chrome Extension (Manifest V3)
- **AI Providers**: AWS Bedrock (Claude), OpenAI (GPT), Google Gemini, Ollama (로컬 LLM), OpenRouter (100+ 모델)
- **GitHub**: https://github.com/sgtlim0/hchat-v2-extension
- **Vercel**: https://hchat-v2-extension.vercel.app/sidepanel.html
- **Stats**: 284 files, 59,974 lines, 2,232 tests (118 files, 8.96s), TypeScript strict, ESLint 0 errors, `any` 2개, console.log 0개

## Features

### 1. Multi-AI Provider System (5개 프로바이더)
- **AWS Bedrock**: Claude Sonnet 4.6, Opus 4.6, Haiku 4.5 (SigV4 서명, Binary Event Stream)
- **OpenAI**: GPT-4o, GPT-4o mini (SSE 스트리밍)
- **Google Gemini**: Flash 2.0, Pro 1.5 (SSE 스트리밍)
- **Ollama**: 로컬 LLM (Llama 3, Mistral, Qwen 등) — NDJSON 스트리밍, 동적 모델 탐색
- **OpenRouter**: 100+ 모델 게이트웨이 — SSE 스트리밍, 5개 프리셋
- 모든 프로바이더 직접 스트리밍 (외부 SDK 미사용, `fetch()` + `AsyncGenerator`)
- Provider Factory + Strategy 패턴으로 통합 관리
- 자동 모델 라우팅: 프롬프트 패턴 분석으로 최적 모델 선택

### 2. AI Chat (ChatView)
- 실시간 스트리밍 응답 (모든 프로바이더)
- 이미지 업로드 + Vision 지원 (Claude, GPT)
- 메시지 액션: 복사, 핀, 편집, 재생성, 포크
- 에이전트 모드 토글 (도구 호출 시각화)
- 웹 검색 소스 표시
- 내보내기 (Markdown, HTML, JSON, TXT)
- TTS/STT + 음성 대화 모드
- 프롬프트 라이브러리 연동
- 대화 포크 (분기점에서 새 대화)
- 딥 리서치 모드 (3단계 자동 리서치)

### 3. Cross-Model Group Chat
- 모든 프로바이더의 모델 동시 비교
- 단일 입력 -> 선택한 모든 모델에 병렬 전송
- 모델별 독립 스트리밍 + 응답 시간 표시

### 4. Cross-Model Debate + Voting (v5.0~v5.6)
- 3라운드 토론 엔진: 초기 답변 -> 상호 비평 -> 종합
- 비서 vs 비서 토론 (커스텀 비서 systemPrompt 주입)
- 투표 시스템: 1~5점 투표, 스코어보드 랭킹, 컨센서스 도출 (threshold 0.7)

### 5. Tools Panel (17개 AI 도구)

| Tool | Description |
|------|-------------|
| Page Summary | 현재 탭 내용 추출 + AI 요약 |
| Multi-Tab Summary | 열린 탭 동시 요약 (최대 10개) |
| YouTube Analysis | 자막/댓글 분석, 통합 리포트 |
| Translation | 50개 언어 지원 |
| Writing | 11가지 텍스트 변환 |
| Grammar | AI 맞춤법/문법 교정 |
| OCR | 이미지 -> 텍스트 추출 (Vision) |
| Batch OCR | 최대 10장 동시 처리, 4가지 모드 |
| PDF Chat | PDF 업로드 후 질의응답 |
| Data Analysis | CSV/Excel -> 요약/트렌드/이상치 분석 |
| Deep Research | 3단계 자동 리서치 (쿼리 -> 검색 -> 리포트) |
| Doc Translation | TXT/CSV/XLSX/PPTX/PDF 파일 번역, 포맷 유지, 중단 기능 |
| Doc Writing | 5가지 문서 유형 AI 생성, 프로젝트 관리, Markdown/DOCX 내보내기 |
| Image Generation | DALL-E 3 (3가지 크기, Standard/HD) |
| Template Doc | DOCX 템플릿 -> {{필드}} 추출 -> AI 내용 생성 |
| PPT Planning | 주제 -> AI 슬라이드 목차/콘텐츠 -> PPTX 다운로드 |
| Page Search | 현재 페이지 내용 검색 |

### 6. Smart Recommendation (v5.3)
- **Intent Detection**: 9가지 의도 자동 분류 (코드, 번역, 요약, 분석, 문서, 이미지, 검색, 대화, 기타)
- **Assistant/Tool Recommendation**: 감지된 의도에 최적화된 비서/도구 자동 추천
- **Usage Pattern Learning**: 가중 빈도 추적 + 시간 감쇠, top 3 추천
- **Conversation Summary**: 20+ 메시지 자동 요약, 시스템 프롬프트 주입
- **BM25 Search**: IDF 도입, combinedScore (BM25 70% + 최신성 30%)

### 7. Enterprise Features (v6.0)
- **Audit Log**: 액션 기록, 필터/검색, CSV/JSON 내보내기, 90일 정리
- **Policy Manager**: 5종 정책 (모델/도구 화이트리스트, PII, 예산, 승인)
- **Team Sharing**: 비서/프롬프트/워크플로우 패키지 생성/검증/적용
- **MCP Client**: MCP 서버 등록, 도구 실행, 리소스 접근
- **Firefox Adapter**: 크로스 브라우저 감지, manifest 변환, 사이드패널 어댑터

### 8. Advanced Features (v5.5~v5.7)
- **Voice Pipeline**: STT -> AI -> TTS 자동 루프, 침묵 감지, 포즈/리줌
- **Assistant Chain**: 비서1 -> 비서2 -> 비서3 순차 파이프라인, {{input}}/{{original}} 치환
- **AI Memory**: 자동 추출 (이름/선호/프로젝트), 검색, 시스템 프롬프트 주입
- **Workflow Builder**: 노드 기반 워크플로우, 조건 분기, 순환 감지
- **Analytics Dashboard**: TF-IDF 토픽 추출, 시간대 히트맵, 프로바이더 비교
- **Context Optimizer**: 토큰 카운팅, 메시지 압축, 컨텍스트 모니터링
- **Conversation Tree**: 포크 트리 시각화, DFS 탐색, 분기 병합
- **Response Template**: 4 프리셋, 후처리, 사용 패턴 학습
- **Collaboration Mode**: BroadcastChannel 탭 동기화, heartbeat

### 9. Infrastructure
- **Web Search + RAG**: DuckDuckGo + Google CSE, 쿼리별 1시간 캐시
- **Agent System**: XML 기반 도구 호출, 8개 내장 도구 + 커스텀 플러그인, 최대 10 스텝
- **Plugin System**: Webhook/JavaScript/Prompt 타입, 에이전트 모드 통합
- **Assistant Marketplace**: 20개 내장 비서 (6 카테고리), 검색/필터/인기순, JSON export/import
- **PII Guardrail**: 이메일, 전화번호, 주민등록번호, 카드번호, 계좌번호 감지/마스킹
- **Offline Support**: 네트워크 감지, 메시지 큐, 재연결 시 자동 전송
- **i18n**: 한국어/영어/일본어 (1,022 keys), 경량 자체 구현 (`t()`, `useLocale()`, `tSync()`)
- **Thinking Depth**: Fast/Normal/Deep 3단계, Claude Extended Thinking (budget_tokens 10000)
- **Virtual Scroll**: react-window (50+ 메시지), MsgBubble React.memo
- **Content Scripts**: 텍스트 선택 툴바 (7액션), 검색 엔진 AI 카드 (Google/Bing/Naver), 글쓰기 어시스턴트
- **Keyboard Shortcuts**: 7개 사이드패널 + 2개 글로벌, 커스텀 키 레코더, 포커스 트랩

## Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| UI | React | 18.3.1 |
| Language | TypeScript | 5.5.3 |
| Build | Vite | 5.4.2 |
| Extension API | Chrome Manifest V3 | 3 |
| AI | Multi-Provider (5) | Bedrock, OpenAI, Gemini, Ollama, OpenRouter |
| Markdown | Custom renderer (v5.1, react-markdown removed) | - |
| Code Highlight | Custom implementation | - |
| PDF | pdfjs-dist (CDN dynamic load) | 4.x |
| i18n | Custom (`t`, `useLocale`, `tSync`) | 1,022 keys |
| Font | IBM Plex Sans KR + IBM Plex Mono | - |
| Style | CSS Variables (Dark Obsidian theme) | - |
| Test | Vitest + React Testing Library | - |
| Virtual Scroll | react-window | 2.2.7 |
| Document | docx, jszip, xlsx | - |

## Supported Models

### AWS Bedrock (Claude)
| Label | Model ID | Cost (1M tokens) |
|-------|----------|-----------------|
| Claude Sonnet 4.6 (recommended) | `us.anthropic.claude-sonnet-4-6` | $3 / $15 |
| Claude Opus 4.6 (best reasoning) | `us.anthropic.claude-opus-4-6-v1` | $15 / $75 |
| Claude Haiku 4.5 (fast) | `us.anthropic.claude-haiku-4-5-20251001-v1:0` | $0.8 / $4 |

### OpenAI
| Label | Model ID | Use Case |
|-------|----------|----------|
| GPT-4o (multimodal) | `gpt-4o` | Code generation, technical tasks |
| GPT-4o mini (fast) | `gpt-4o-mini` | Fast and economical |

### Google Gemini
| Label | Model ID | Use Case |
|-------|----------|----------|
| Gemini Flash 2.0 (ultra-fast) | `gemini-2.0-flash-exp` | Ultra-fast response |
| Gemini Pro 1.5 (advanced) | `gemini-1.5-pro` | Long context, complex tasks |

### Ollama (Local LLM)
| Label | Model ID | Use Case |
|-------|----------|----------|
| (Dynamic) | Auto-discovered | Local models (Llama 3, Mistral, Qwen, etc.) |

NDJSON streaming, dynamic model discovery via `/api/tags`. Default: `http://localhost:11434`.

### OpenRouter (100+ Models)
| Label | Model ID | Use Case |
|-------|----------|----------|
| 5 Presets + Custom | User-selected | Access to 100+ models via gateway |

SSE streaming (OpenAI-compatible API). Requires API key from openrouter.ai.

## Architecture

### Overall Architecture

```
+-------------------------------------------------------------------+
|                        Chrome Browser                              |
+----------+----------+-----------+------------------+---------------+
| Side     | Popup    | Content   | Background       | Sandbox       |
| Panel    |          | Scripts   | Service Worker   | (JS plugins)  |
| (8 tabs) | (launch) | (4 files) | (ports, ctx)     | (iframe)      |
+----------+----------+-----------+------------------+---------------+
|                    chrome.storage.local (26+ keys)                 |
+-------------------------------------------------------------------+
|                    chrome.runtime messages/ports                    |
+-------------------------------------------------------------------+
|  AWS Bedrock   |  OpenAI API  |  Gemini API  | Ollama  | OpenRouter|
|  (SigV4+HTTPS) |  (SSE)       |  (SSE)       | (NDJSON)| (SSE)    |
|  Claude 3      |  GPT-4o      |  Flash/Pro   | Local   | 100+     |
+-------------------------------------------------------------------+
```

### Entry Points (vite.config.ts)

| Entry | Output | Purpose |
|-------|--------|---------|
| `sidepanel.html` | Side panel UI | Main React app (8 tabs) |
| `popup.html` | Extension popup | Quick-access popup |
| `src/background/index.ts` | `background.js` | Service worker: context menus, streaming ports |
| `src/content/index.ts` | `content.js` | Content script: text selection toolbar |
| `src/content/search-injector.ts` | `search-injector.js` | AI summary cards on search results (Shadow DOM) |
| `src/content/writing-assistant.ts` | `writing-assistant.js` | Textarea writing transforms |

### Chat Data Flow

```
User Input
    |
    +- PII Guardrail -> detectPII() -> warn/mask/block
    |
    +- Web Search? -> searchIntent.ts -> webSearch.ts -> RAG injection
    |
    +- Agent Mode? -> agent.ts (max 10 steps) -> agentTools.ts (8 tools + plugins)
    |
    +- Page Context? -> executeScript -> pageContext.ts -> system prompt
    |
    +-> provider.stream() -> AsyncGenerator<string, string>
                |
                +-> Side Panel: for await (chunk) -> setMessages()
                +-> Content: port.postMessage({ type: 'chunk' })
```

### Provider System (`src/lib/providers/`)

All providers implement `AIProvider` interface with `AsyncGenerator<string, string>` for streaming:

```
AIProvider interface
    |
    +-- BedrockProvider (SigV4 + Binary Event Stream)
    +-- OpenAIProvider (SSE, data: line parsing)
    +-- GeminiProvider (SSE, systemInstruction separate)
    +-- OllamaProvider (NDJSON, dynamic model discovery)
    +-- OpenRouterProvider (SSE, OpenAI-compatible)
    |
    +-- provider-factory.ts (create, discover, route)
    +-- model-router.ts (prompt pattern -> optimal model)
    +-- stream-retry.ts (auto-retry with skip-ahead)
```

### Storage Schema (26+ keys)

| Key Pattern | Module | Purpose |
|-------------|--------|---------|
| `hchat:config` | useConfig | User configuration (5 provider credentials) |
| `hchat:conv:*` / `hchat:conv-index` | chatHistory | Chat history (max 200 index) |
| `hchat:highlights` / `hchat:highlight-index` | bookmarks | Text highlights (XPath) |
| `hchat:usage` | usage | Token/cost tracking (90 day retention) |
| `hchat:plugins` | pluginRegistry | Custom tool/plugin definitions |
| `hchat:message-queue` | messageQueue | Offline message queue (FIFO) |
| `hchat:search-index` | messageSearch | Inverted search index cache |
| `hchat:assistants` / `hchat:active-assistant` | assistantBuilder | Custom assistant definitions |
| `hchat:doc-projects` / `hchat:doc-project:*` | docProjects | Document project management |
| `hchat:doc-templates` | docTemplateStore | Template gallery (Base64 DOCX) |
| `hchat:chat-templates` | chatTemplates | Conversation templates (max 20) |
| `hchat:guardrail-config` | guardrail | PII guardrail settings |
| `hchat:user-prefs` | userPreferences | Usage pattern preferences |
| `hchat:conv-summaries` | conversationSummarizer | Conversation summary cache (FIFO) |
| `hchat:assistant-chains` | assistantChain | Assistant chain pipeline |
| `hchat:prompt-cache` | promptCache | BM25 similarity cache (TTL 24h) |
| `hchat:ai-memories` | aiMemory | AI long-term memory (max 100) |
| `hchat:response-styles` | responseTemplate | Response style presets (max 20) |
| `hchat:workflows` | workflowBuilder | Workflow definitions (max 20) |
| `hchat:mcp-servers` | mcpClient | MCP server registrations (max 10) |
| `hchat:audit-log` | auditLog | Audit log entries (max 1000) |
| `hchat:policies` | policyManager | Policy definitions (max 20) |
| `hchat:share-history` | teamSharing | Team sharing history (max 50) |

## Project Structure

```
hchat-v2-extension/
+-- manifest.json                  # Chrome MV3 manifest (v6.0.0)
+-- package.json                   # Dependencies (7 runtime)
+-- vite.config.ts                 # Multi-entry + static asset copy
+-- tsconfig.json                  # TypeScript (ES2020, strict)
+-- vitest.config.ts               # Vitest (jsdom, v8 coverage)
+-- eslint.config.js               # ESLint flat config
+-- sidepanel.html / popup.html    # HTML entry points
+-- docs/
|   +-- roadmap.md                 # Version roadmap (v3.x ~ v6.0)
|   +-- competitive-analysis.md    # Competitor analysis & feature gaps
|   +-- feature-design-inspired.md # Competitor-inspired feature designs
|   +-- implementation-plan-features.md
|   +-- chrome-web-store.md        # Chrome Web Store deploy guide
|   +-- sider-upgrade-design.md    # v2->v3 upgrade plan
|   +-- additional-features-design.md
|   +-- work-log-2026-03-02.md     # Initial work log
+-- public/
|   +-- icons/                     # Extension icons (16, 48, 128px)
|   +-- content.css                # Highlight styles
|   +-- sandbox.html               # JS plugin sandbox iframe (v6.0.1)
+-- src/
    +-- background/
    |   +-- index.ts               # Service worker (236 lines)
    +-- content/
    |   +-- index.ts               # Page context tracking (136 lines)
    |   +-- toolbar.ts             # Floating AI toolbar (473 lines)
    |   +-- search-injector.ts     # Search engine AI cards
    |   +-- writing-assistant.ts   # Textarea writing toolbar
    +-- sidepanel/
    |   +-- App.tsx                # Main app (8 tabs, 168 lines)
    |   +-- main.tsx               # React mount
    +-- popup/
    |   +-- PopupApp.tsx           # Quick launcher (100 lines)
    |   +-- main.tsx               # React mount
    +-- i18n/
    |   +-- index.ts               # t(), useLocale(), tSync(), getLocale()
    |   +-- ko.ts                  # Korean (1,022 keys)
    |   +-- en.ts                  # English (1,022 keys)
    |   +-- ja.ts                  # Japanese (1,021 keys)
    +-- components/                # 64 components
    |   +-- ChatView.tsx           # Main chat (568 lines)
    |   +-- GroupChatView.tsx      # Cross-model comparison
    |   +-- DebateView.tsx         # Cross-model debate + voting
    |   +-- ToolsView.tsx          # Tool panel (17 tools)
    |   +-- SettingsView.tsx       # Settings (418 lines)
    |   +-- HistoryView.tsx        # Chat history
    |   +-- BookmarksView.tsx      # Highlight management
    |   +-- PromptLibraryView.tsx  # Prompt library
    |   +-- UsageView.tsx          # Usage dashboard
    |   +-- WorkflowEditor.tsx     # Workflow builder (367 lines)
    |   +-- chat/                  # 15 sub-components (MsgBubble, CodeBlock, MarkdownRenderer...)
    |   +-- tools/                 # 20 tool sub-components
    +-- hooks/
    |   +-- useChat.ts             # Core chat logic (489 lines)
    |   +-- useConfig.ts           # Config management (deep-merge, 5 providers)
    |   +-- useProvider.ts         # Provider instances, model lists, routing
    |   +-- useNetworkStatus.ts    # Online/offline detection
    |   +-- useShortcuts.ts        # Keyboard shortcut binding
    +-- lib/                       # 81 modules
    |   +-- providers/             # 5 providers + factory + router + retry
    |   +-- agent.ts + agentTools.ts  # Multi-turn agent (8 tools)
    |   +-- chatHistory.ts         # Conversation CRUD
    |   +-- storage.ts             # chrome.storage.local wrapper
    |   +-- guardrail.ts           # PII detection/masking
    |   +-- sandboxExecutor.ts     # JS plugin sandbox (v6.0.1)
    |   +-- ... (81 total)
    +-- styles/
        +-- global.css             # Design system (~40KB)
```

## Setup & Development

### Requirements
- Node.js 18+
- At least one AI provider API key:
  - AWS Bedrock: Access Key ID + Secret Access Key
  - OpenAI: API Key
  - Google Gemini: API Key
  - Ollama: Local server running (no key needed)
  - OpenRouter: API Key

### Install & Build

```bash
npm install
npm run dev        # Watch mode build
npm run build      # Production build -> dist/
npm test           # Vitest (2,232 tests, 118 files, ~9s)
npm run lint       # ESLint (0 errors)
```

### Chrome Extension Load

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" -> select `dist/` folder

### Initial Setup

1. Click extension icon -> open side panel
2. Go to Settings tab
3. Enter at least one provider's API credentials
4. Click "Test Connection"
5. (Optional) Configure Google Search API key for enhanced web search

## Design System

### Colors (Dark Obsidian Theme)

| Token | Dark | Light |
|-------|------|-------|
| Background (0-5) | `#080b0e ~ #2a3a52` | `#ffffff ~ #c0c5cd` |
| Text (0-3) | `#eef1f5 ~ #3d4f65` | `#1a1a2e ~ #a0aec0` |
| Accent | `#34d399` (Emerald) | `#059669` |
| Utility | `#a78bfa` (purple), `#60a5fa` (blue), `#fbbf24` (amber), `#f87171` (red) |

### Provider Colors (PROVIDER_COLORS constant)

| Provider | Color | Hex |
|----------|-------|-----|
| Bedrock | AWS Orange | `#ff9900` |
| OpenAI | Teal | `#10a37f` |
| Gemini | Google Blue | `#4285f4` |
| Ollama | Gray | `#808080` |
| OpenRouter | Purple | `#7c3aed` |

### Typography
- **Sans**: IBM Plex Sans KR (300-700)
- **Mono**: IBM Plex Mono (300-600)
- **Body**: 13px, line-height 1.6
- **Radius**: 10px (default), 6px (small)

## Security

### Data Protection
- All data stored locally in `chrome.storage.local` (no external sync)
- No telemetry, analytics, or external data collection
- API keys stored locally only (never transmitted to third parties)

### Execution Security
- **Sandbox**: User JavaScript plugins execute in MV3 sandbox iframe (`sandboxExecutor.ts`)
- **CSP**: `script-src 'self'; object-src 'none'`
- **Shadow DOM**: Content scripts use `mode: 'closed'` for host page isolation
- **safeEvalMath**: Agent `calculate` tool uses regex whitelist (no eval/Function)

### AI Guardrails
- **PII Detection**: Email, phone, SSN, credit card, bank account auto-detection
- **Actions**: Warn (default), mask, or block before sending to AI
- **Policy Manager**: 5 policy types (model/tool whitelist, PII, budget, approval)
- **Audit Log**: Action recording, filter/search, CSV/JSON export, 90-day retention

### Communication
- AWS Bedrock: HTTPS + SigV4 signature (Web Crypto API)
- OpenAI/Gemini/OpenRouter: HTTPS + Bearer token / API key
- Ollama: Local HTTP (localhost only by default)
- Content scripts: Isolated world execution

## Manifest Permissions

| Permission | Purpose |
|------------|---------|
| `storage` | Chat history, settings, highlights, usage, plugins |
| `sidePanel` | Side panel API |
| `contextMenus` | Right-click menu (explain, translate, summarize, rewrite) |
| `activeTab` | Current tab content access |
| `scripting` | executeScript (page context, YouTube) |
| `tabs` | Tab management |
| `<all_urls>` | AI API communication + content script injection |

## Version History

### v6.0.0 (2026-03-07) — Platform Extension & Enterprise

| Feature | Description |
|---------|-------------|
| Ollama Provider | Local LLM (NDJSON streaming, dynamic model discovery) |
| OpenRouter Provider | 100+ models (OpenAI SSE compatible, 5 presets) |
| Team Sharing | Package creation/validation/application, history |
| MCP Client | Server registration, tool execution, resource access |
| Audit Log | Action recording, filter/search, CSV/JSON export |
| Policy Manager | 5 policy types (model/tool whitelist, PII, budget, approval) |
| Firefox Adapter | Browser detection, manifest conversion, side panel adapter |
| Sandbox Security | JS plugin execution in MV3 sandbox iframe (v6.0.1) |
| Stats | 64 components, 81 lib, 5 providers, 2,232 tests (118 files), 1,022 i18n keys |

### v5.7.0 (2026-03-06) — Advanced Features (9 modules + 6 UI)

Context optimizer, prompt cache, analytics dashboard, AI memory, conversation tree, response templates, multimodal input, collaboration mode, workflow builder. 2,055 tests (108 files).

### v5.5.0~v5.6 (2026-03-05) — Voice Pipeline & Integrations

Voice E2E pipeline (STT->AI->TTS), assistant chain, debate voting, keyboard shortcut manager, chain builder UI, voice conversation UI, shortcuts config UI. 1,787 tests (93 files), 80%+ branch coverage.

### v5.0.0~v5.4 (2026-03-03~05) — UX Enhancement & Smart Features

Assistant marketplace (20 built-in), PPT planning, PII guardrail, conversation templates, intent router (9 intents), BM25 search, user preferences, conversation summarizer. 1,210 tests (59 files).

### v4.0~v4.5 (2026-03) — Document Tools & Media

Custom assistant builder, batch OCR, document translation (TXT/CSV/XLSX/PPTX/PDF), document writing (5 types), image generation (DALL-E 3), template documents, document projects. 649 tests (36 files).

### v3.0~v3.6 (2026-03) — Multi-Provider & Browser Integration

Multi-provider system (Bedrock/OpenAI/Gemini), model routing, cross-model debate, YouTube analysis, PDF chat, search engine AI cards, writing assistant, thinking depth, deep research, data analysis, offline support, plugin system, i18n (ko/en/ja). 365 tests.

### v2.0.0 (2025-12) — Foundation

Web search + RAG, multi-turn agent, smart bookmarks, page context, keyboard shortcuts, export/import, message search, usage tracking, group chat, YouTube summary.

### Scale Comparison

| Metric | v2 | v3 | v5.0 | v5.7 | v6.0 |
|--------|:--:|:--:|:----:|:----:|:----:|
| Source files | ~40 | ~50 | ~115 | ~180 | ~200 |
| Code lines | ~8K | ~10K | ~25K | ~38K | ~42K |
| Components | 18 | 24 | 52 | 61 | 64 |
| Lib modules | 20 | 30 | 56 | 74 | 81 |
| Providers | 1 | 3 | 3 | 3 | 5 |
| Tools | 8 | 8 | 17 | 17 | 17 |
| Built-in assistants | 0 | 0 | 20 | 20 | 20 |
| Tests | 0 | 0 | 741 | 2,055 | 2,232 |
| i18n keys | 0 | 0 | 720+ | 893+ | 1,022 |

## Documentation

| File | Description |
|------|-------------|
| `CLAUDE.md` | Claude Code guidance (entry points, providers, hooks, storage, constraints) |
| `src/*/README.md` | Per-directory documentation (9 files: background, content, sidepanel, popup, hooks, lib, components, i18n, styles) |
| `docs/roadmap.md` | Version roadmap (v3.x ~ v6.0) |
| `docs/competitive-analysis.md` | Competitor analysis & feature gaps |
| `docs/chrome-web-store.md` | Chrome Web Store deployment guide |
| `docs/feature-design-inspired.md` | Competitor-inspired feature designs |
| `docs/implementation-plan-features.md` | Feature implementation plans |
| `docs/sider-upgrade-design.md` | v2 -> v3 upgrade design |

## License

Private
