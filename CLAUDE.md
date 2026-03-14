# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

H Chat is a Chrome Extension (Manifest V3) that provides a multi-AI sidebar assistant supporting AWS Bedrock (Claude), OpenAI (GPT), Google Gemini, Ollama (local LLM), and OpenRouter (100+ models). Korean is the primary UI language. 311 files, 2,737 tests across 143 test files.

## Commands

```bash
npm run build    # Production build to dist/
npm run dev      # Watch mode (vite build --watch)
npm run clean    # Remove dist/
npm test         # Run all tests (Vitest, 2737 tests, 143 files, ~10s)
npm run lint     # ESLint (flat config, 0 errors)
```

After building, load `dist/` as an unpacked Chrome extension.

## Architecture

### Entry Points (defined in vite.config.ts)

| Entry | Output | Purpose |
|-------|--------|---------|
| `sidepanel.html` | Side panel UI | Main React app (8 tabs: chat, group, tools, debate, prompts, history, bookmarks, settings) |
| `popup.html` | Extension popup | Quick-access popup |
| `src/background/index.ts` | `background.js` | Service worker: context menus, streaming via ports (`toolbar-stream`, `inline-stream`). Uses `provider-factory` for provider resolution. |
| `src/content/index.ts` | `content.js` | Content script: text selection toolbar + page context tracking (popstate/pushState SPA detection) |
| `src/content/search-injector.ts` | `search-injector.js` | AI summary cards on Google/Bing/Naver search results (Shadow DOM) |
| `src/content/writing-assistant.ts` | `writing-assistant.js` | Textarea writing transforms via floating toolbar |

### Provider System (`src/lib/providers/`)

All AI providers implement the `AIProvider` interface (`types.ts`), which uses `AsyncGenerator<string, string>` for streaming (yield chunks, return full text). `ProviderType = 'bedrock' | 'openai' | 'gemini' | 'ollama' | 'openrouter'`.

- `bedrock-provider.ts` — AWS Bedrock Claude (SigV4 signing via `aws-sigv4.ts`, binary event stream parsing)
- `openai-provider.ts` — OpenAI GPT (uses shared `sse-parser.ts`)
- `gemini-provider.ts` — Google Gemini (uses shared `sse-parser.ts`, API key via `x-goog-api-key` header)
- `ollama-provider.ts` — Ollama local models (NDJSON streaming, `safeFetch` with `allowLocalhost`)
- `openrouter-provider.ts` — OpenRouter multi-model gateway (uses shared `sse-parser.ts`)
- **Shared utilities (v7.0)**:
  - `sse-parser.ts` — Unified SSE stream parser with `extractContent` callback
  - `error-parser.ts` — Unified error response parser (`throwProviderError`)
  - `message-converter.ts` — Unified OpenAI-format message converter (`convertToOpenAIMessages`)
  - `stream-retry.ts` — Retry wrapper with linear backoff
- `provider-factory.ts` — `createAllProviders()`, `getProviderForModel()`, `getAllModels()`
- `model-router.ts` — `routeModel()` auto-selects model based on prompt patterns

### Key Hooks (`src/hooks/`)

**Chat hooks** (v7.0 decomposition from God Hook):
- `useChat.ts` (~165줄, orchestrator) — Composes sub-hooks, `sendMessage` orchestration. Uses `useRef` for deps optimization.
- `useChatConversation.ts` — conv/messages state, `startNew`, `loadConv`
- `useChatStreaming.ts` — Streaming with rAF batching (~16fps), `executeChatMode` (pure async function)
- `useChatAgent.ts` — Agent mode, `executeAgentMode` (pure async function)
- `useChatActions.ts` — `editAndResend`, `regenerate`, `runTemplate`
- `usePIIGuardrail.ts` — PII detection, confirm/mask/cancel flow

**UI hooks** (v7.0 decomposition from ChatView):
- `useChatVoice.ts` — Voice mode, STT/TTS, auto-send/auto-TTS
- `useChatPrompts.ts` — Slash command prompt search/apply
- `useDeepResearch.ts` — Deep research streaming with AbortController

**Config/Provider hooks**:
- `useConfig.ts` — Config in `chrome.storage.local` under `hchat:config`. Runtime validation via `validateConfig()` with graceful fallback to defaults.
- `useProvider.ts` — Memoized provider instances (cached via `useMemo`, invalidated on config change).
- `useNetworkStatus.ts` — Online/offline detection

### Data Flow for Streaming

**Side panel**: `useChat` → `useProvider` (memoized) → `provider.stream()` → rAF batched `setMessages()` → React render (~16fps)

**Content scripts**: `chrome.runtime.connect({ name: 'inline-stream' })` → background `resolveProvider` (via `provider-factory`) → streams back via `port.postMessage()`

### Agent System (`src/lib/agent.ts` + `agentTools.ts`)

XML-based tool calling (`<tool_call>`) supporting 8 built-in tools + user-defined custom tools via `pluginRegistry.ts`. Plugin types: webhook, javascript, prompt template. All external URL fetches use `safeFetch()` for SSRF protection. Custom assistants (`assistantBuilder.ts`) can bind specific tools + model + system prompt.

### Security (v7.0 + v8.0)

- **XSS**: `MarkdownRenderer.tsx` uses React elements only (no `dangerouslySetInnerHTML` anywhere). `MessageSearchModal` uses React element-based highlighting.
- **SSRF**: `safeFetch.ts` wraps `validateExternalUrl()` — blocks internal IPs (127.x, 10.x, 172.16-31.x, 192.168.x, 169.254.x, ::1), unsafe protocols (file:, data:, javascript:). `allowLocalhost` option for Ollama. Applied to: agentTools, pluginRegistry, mcpClient, ollama-provider, usageAlert, webSearch.
- **API Keys**: Gemini uses `x-goog-api-key` header (not URL). `credentialStore.ts` uses `chrome.storage.session` for runtime keys.
- **Sandbox**: `sandboxExecutor.ts` verifies `event.origin`, no wildcard postMessage.
- **URL Validator**: `urlValidator.ts` — comprehensive private IP/protocol blocking with IPv4-mapped IPv6 support.

### Storage Pattern

All persistence uses `chrome.storage.local` via `src/lib/storage.ts` wrapper with:
- **LRU in-memory cache** (5s TTL, write-through, `invalidateCache()`)
- **TTL support**: `set(key, value, ttlMs?)` — auto-expires on `get()`
- **Backward compatible** — handles legacy data without TTL wrapper

Storage keys centralized in `src/lib/storageKeys.ts` as `SK.*` constants (44 keys). No string literals for storage keys in source code.

Key prefixes: `hchat:config`, `hchat:conv:*`, `hchat:conv-index`, `hchat:bookmarks`, `hchat:usage:*`, `hchat:plugins`, `hchat:message-queue`, `hchat:search-index`, `hchat:assistants`, `hchat:active-assistant`, `hchat:doc-projects`, `hchat:doc-templates`, `hchat:chat-templates`, `hchat:guardrail-config`, `hchat:user-prefs`, `hchat:conv-summaries`, `hchat:assistant-chains`, `hchat:prompt-cache`, `hchat:ai-memories`, `hchat:response-styles`, `hchat:workflows`, `hchat:mcp-servers`, `hchat:audit-log`, `hchat:policies`, `hchat:share-history`

### Styling

Modular CSS (v7.0): `src/styles/global.css` is a barrel import of 7 modules:
- `base.css` — Variables (:root, .light), reset, focus, scrollbar, @keyframes
- `layout.css` — App shell, topbar, tabs
- `sidebar.css` — Panel common, history
- `components.css` — Buttons, forms, badges, modals
- `chat.css` — Messages, input, markdown, agent, voice
- `tools.css` — Tool grid, debate, image gen
- `settings.css` — Settings, provider cards, prompt library

No Tailwind. Dark theme by default with light theme support. Provider brand colors in `PROVIDER_COLORS`: Bedrock `#ff9900`, OpenAI `#10a37f`, Gemini `#4285f4`.

### Component Architecture (v7.0 decomposition)

```
ChatView (280줄, orchestrator)
├── ChatToolbar
├── SummaryPanel / PinnedPanel / UsageAlertBanner
├── ChatMessages (110줄, virtual scroll >50 msgs)
│   └── MsgBubble (React.memo with custom comparator)
│       └── MarkdownRenderer (React elements, XSS-safe)
├── ChatInputArea
└── ChatMetaBar (46줄)
    ├── ModelSelector / AssistantSelector
    ├── ThinkingDepthSelector / DeepResearchToggle
    └── Status badges
```

## AWS Bedrock Model IDs

Each model has a different suffix pattern:
```
Sonnet 4.6: us.anthropic.claude-sonnet-4-6          (no suffix)
Opus 4.6:   us.anthropic.claude-opus-4-6-v1          (-v1 only)
Haiku 4.5:  us.anthropic.claude-haiku-4-5-20251001-v1:0  (-v1:0)
```

### Internationalization (`src/i18n/`)

3 locales: Korean (primary), English, Japanese. Lightweight custom implementation — `t()` function + `useLocale()` hook. 930+ keys per locale. Content scripts use `tSync()` + `getLocale()`.

## Key Constraints

- No external AI SDKs — all provider communication uses `fetch()` directly (or `safeFetch()` for untrusted URLs)
- No external markdown/syntax highlighting libs — custom renderers only
- Virtual scrolling: react-window for 50+ messages
- Files should stay under 800 lines; extract into separate files if approaching limit
- Korean is the primary UI language, with English and Japanese translations
- Immutable patterns throughout (never mutate objects — spread pattern, no `.push()` on shared state)
- Tests: Vitest with chrome.storage.local mock, 2,737 tests across 143 files
- Storage keys: always use `SK.*` constants from `storageKeys.ts`, never string literals
- External fetch: always use `safeFetch()` for untrusted/user-supplied URLs
- No `dangerouslySetInnerHTML` — use React elements for all rendering
