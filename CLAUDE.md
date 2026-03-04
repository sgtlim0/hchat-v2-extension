# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

H Chat is a Chrome Extension (Manifest V3) that provides a multi-AI sidebar assistant supporting AWS Bedrock (Claude), OpenAI (GPT), and Google Gemini. Korean is the primary UI language.

## Commands

```bash
npm run build    # Production build to dist/
npm run dev      # Watch mode (vite build --watch)
npm run clean    # Remove dist/
npm test         # Run all tests (Vitest, 1148 tests, 54 files)
npm run lint     # ESLint (flat config)
```

After building, load `dist/` as an unpacked Chrome extension.

## Architecture

### Entry Points (defined in vite.config.ts)

| Entry | Output | Purpose |
|-------|--------|---------|
| `sidepanel.html` | Side panel UI | Main React app (8 tabs: chat, group, tools, debate, prompts, history, bookmarks, settings) |
| `popup.html` | Extension popup | Quick-access popup |
| `src/background/index.ts` | `background.js` | Service worker: context menus, streaming via ports (`toolbar-stream`, `inline-stream`) |
| `src/content/index.ts` | `content.js` | Content script: text selection toolbar |
| `src/content/search-injector.ts` | `search-injector.js` | AI summary cards on Google/Bing/Naver search results (Shadow DOM) |
| `src/content/writing-assistant.ts` | `writing-assistant.js` | Textarea writing transforms via floating toolbar |

### Provider System (`src/lib/providers/`)

All AI providers implement the `AIProvider` interface (`types.ts`), which uses `AsyncGenerator<string, string>` for streaming (yield chunks, return full text). `types.ts` also exports `PROVIDER_COLORS` constant (v5.1 centralization).

- `bedrock-provider.ts` — AWS Bedrock Claude (SigV4 signing via `aws-sigv4.ts`, binary event stream parsing)
- `openai-provider.ts` — OpenAI GPT (SSE streaming, `data:` line parsing)
- `gemini-provider.ts` — Google Gemini (SSE streaming, `systemInstruction` separate from `contents`)
- `provider-factory.ts` — `createAllProviders()`, `getProviderForModel()`, `getAllModels()`
- `model-router.ts` — `routeModel()` auto-selects model based on prompt patterns (code/reasoning/fast)

### Key Hooks (`src/hooks/`)

- `useConfig.ts` — Config stored in `chrome.storage.local` under `hchat:config`. Deep-merges nested objects (aws/openai/gemini) on load and update.
- `useChat.ts` — Core chat logic. Uses provider.stream() with `for await...of`. Includes offline message queueing and custom plugin integration for agent mode.
- `useNetworkStatus.ts` — Online/offline detection via `navigator.onLine` + events.
- `useProvider.ts` — Memoized provider instances, model lists, routing. Wraps provider-factory and model-router.

### Data Flow for Streaming

**Side panel**: `useChat` → `provider.stream()` → `for await (chunk)` → `setStreamingContent()`

**Content scripts**: `chrome.runtime.connect({ name: 'inline-stream' })` → background service worker creates provider → streams back via `port.postMessage()`

### Agent System (`src/lib/agent.ts` + `agentTools.ts`)

XML-based tool calling (`<tool_call>`) supporting 8 built-in tools + user-defined custom tools via `pluginRegistry.ts`. Plugin types: webhook, javascript, prompt template. Custom tools merge with built-ins in agent mode. Custom assistants (`assistantBuilder.ts`) can bind specific tools + model + system prompt as a package.

### Smart Recommendation System (v5.3, `src/lib/`)

- `intentRouter.ts` — `detectIntent()` classifies user input into 9 intent categories, `recommendAssistant()` and `recommendTool()` suggest best matches
- `userPreferences.ts` — Weighted frequency tracking with time decay, persists to `hchat:user-prefs`, returns top 3 recommendations
- `conversationSummarizer.ts` — Auto-summarizes conversations with 20+ messages, FIFO cache (`hchat:conv-summaries`), injects summary into system prompt
- `bm25.ts` — BM25 scoring with IDF, `combinedScore()` blends BM25 (70%) + recency (30%) for improved search ranking

### Storage Pattern

All persistence uses `chrome.storage.local` via `src/lib/storage.ts` wrapper. Key prefixes:
- `hchat:config` — User configuration
- `hchat:conv:*` / `hchat:conv-index` — Chat history
- `hchat:bookmarks` — Saved messages
- `hchat:usage:*` — Usage tracking records
- `hchat:plugins` — Custom tool/plugin definitions
- `hchat:message-queue` — Offline message queue
- `hchat:search-index` — Inverted search index cache
- `hchat:assistants` — Custom assistant definitions
- `hchat:active-assistant` — Currently active assistant ID
- `hchat:doc-projects` / `hchat:doc-project:*` — Document project management
- `hchat:doc-templates` — Template gallery storage
- `hchat:chat-templates` — Chat conversation templates
- `hchat:guardrail-config` — PII guardrail settings
- `hchat:user-prefs` — User usage pattern preferences (weighted frequency, time decay)
- `hchat:conv-summaries` — Conversation summary cache (FIFO)

### Styling

Pure CSS with CSS variables in `src/styles/global.css`. No Tailwind. Dark theme by default with light theme support. Provider brand colors centralized in `PROVIDER_COLORS` (v5.1): Bedrock `#ff9900`, OpenAI `#10a37f`, Gemini `#4285f4`.

## AWS Bedrock Model IDs

Each model has a different suffix pattern:
```
Sonnet 4.6: us.anthropic.claude-sonnet-4-6          (no suffix)
Opus 4.6:   us.anthropic.claude-opus-4-6-v1          (-v1 only)
Haiku 4.5:  us.anthropic.claude-haiku-4-5-20251001-v1:0  (-v1:0)
```

### Internationalization (`src/i18n/`)

3 locales: Korean (primary), English, Japanese. Lightweight custom implementation — `t()` function + `useLocale()` hook. 730+ keys per locale. Content scripts use `tSync()` + `getLocale()`. v5.1: toolbar.ts fully integrated with i18n (6 keys added, Japanese support).

## Key Constraints

- No external AI SDKs — all provider communication uses `fetch()` directly
- No external markdown/syntax highlighting libs — custom renderers only (v5.1: react-markdown/remark-gfm/rehype-highlight removed, ~130KB savings)
- Virtual scrolling: react-window for 50+ messages (v5.2)
- Files should stay under 800 lines; extract into separate files if approaching limit
- Korean is the primary UI language, with English and Japanese translations
- Immutable patterns throughout (never mutate objects)
- Tests: Vitest with chrome.storage.local mock, 1148 tests across 54 files
