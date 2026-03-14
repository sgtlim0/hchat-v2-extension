/**
 * Background Service Worker tests
 * Tests: context menu setup, message handlers, highlight CRUD,
 * tab activation, provider creation, port streaming, keyboard commands
 */

import type { AIProvider } from '../../lib/providers/types'
import { SK } from '../../lib/storageKeys'

// ── Provider mocks ──────────────────────────────────────
// Mock all provider modules so importing background/index doesn't attempt real network

function createMockProvider(type: string): AIProvider {
  return {
    type: type as AIProvider['type'],
    models: [],
    isConfigured: () => true,
    testConnection: vi.fn().mockResolvedValue(true),
    stream: vi.fn(async function* () {
      yield 'chunk1'
      yield 'chunk2'
      return 'chunk1chunk2'
    }),
  }
}

const mockBedrockInstance = createMockProvider('bedrock')
const mockOpenAIInstance = createMockProvider('openai')
const mockGeminiInstance = createMockProvider('gemini')
const mockOllamaInstance = createMockProvider('ollama')
const mockOpenRouterInstance = createMockProvider('openrouter')

vi.mock('../../lib/providers/bedrock-provider', () => ({
  BedrockProvider: vi.fn(function () { return mockBedrockInstance }),
}))
vi.mock('../../lib/providers/openai-provider', () => ({
  OpenAIProvider: vi.fn(function () { return mockOpenAIInstance }),
}))
vi.mock('../../lib/providers/gemini-provider', () => ({
  GeminiProvider: vi.fn(function () { return mockGeminiInstance }),
}))
vi.mock('../../lib/providers/ollama-provider', () => ({
  OllamaProvider: vi.fn(function () { return mockOllamaInstance }),
}))
vi.mock('../../lib/providers/openrouter-provider', () => ({
  OpenRouterProvider: vi.fn(function () { return mockOpenRouterInstance }),
}))

// ── Chrome API mock with listener capture ──────────────
// The background script registers listeners at module top level.
// We capture all listener callbacks so we can invoke them in tests.

type ListenerCallback = (...args: unknown[]) => unknown

const listeners: Record<string, ListenerCallback[]> = {
  'runtime.onInstalled': [],
  'runtime.onMessage': [],
  'runtime.onConnect': [],
  'action.onClicked': [],
  'contextMenus.onClicked': [],
  'tabs.onActivated': [],
  'commands.onCommand': [],
}

function captureListener(key: string) {
  return vi.fn((cb: ListenerCallback) => {
    listeners[key].push(cb)
  })
}

const mockChrome = {
  contextMenus: {
    create: vi.fn(),
    onClicked: { addListener: captureListener('contextMenus.onClicked') },
  },
  runtime: {
    onInstalled: { addListener: captureListener('runtime.onInstalled') },
    onMessage: { addListener: captureListener('runtime.onMessage') },
    onConnect: { addListener: captureListener('runtime.onConnect') },
    sendMessage: vi.fn().mockResolvedValue(undefined),
  },
  action: {
    onClicked: { addListener: captureListener('action.onClicked') },
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
    onActivated: { addListener: captureListener('tabs.onActivated') },
  },
  sidePanel: {
    open: vi.fn().mockResolvedValue(undefined),
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    },
  },
  commands: {
    onCommand: { addListener: captureListener('commands.onCommand') },
  },
}

// Install mock before importing the module
Object.defineProperty(globalThis, 'chrome', { value: mockChrome, writable: true })

// ── Import the module (side effects register all listeners) ──
beforeAll(async () => {
  await import('../index')
})

// ── Helpers ──────────────────────────────────────────────
function getListener(key: string): ListenerCallback {
  const cbs = listeners[key]
  if (!cbs.length) throw new Error(`No listener registered for ${key}`)
  return cbs[0]
}

async function resetChromeMocks() {
  mockChrome.contextMenus.create.mockClear()
  mockChrome.sidePanel.open.mockClear()
  mockChrome.tabs.query.mockClear()
  mockChrome.tabs.sendMessage.mockClear()
  mockChrome.storage.local.get.mockReset()
  mockChrome.storage.local.set.mockReset().mockResolvedValue(undefined)

  // Reset provider constructor mocks
  const { BedrockProvider } = await import('../../lib/providers/bedrock-provider')
  const { OpenAIProvider } = await import('../../lib/providers/openai-provider')
  const { GeminiProvider } = await import('../../lib/providers/gemini-provider')
  const { OllamaProvider } = await import('../../lib/providers/ollama-provider')
  const { OpenRouterProvider } = await import('../../lib/providers/openrouter-provider')
  ;(BedrockProvider as ReturnType<typeof vi.fn>).mockClear()
  ;(OpenAIProvider as ReturnType<typeof vi.fn>).mockClear()
  ;(GeminiProvider as ReturnType<typeof vi.fn>).mockClear()
  ;(OllamaProvider as ReturnType<typeof vi.fn>).mockClear()
  ;(OpenRouterProvider as ReturnType<typeof vi.fn>).mockClear()

  // Reset mock provider stream
  mockBedrockInstance.stream = vi.fn(async function* () {
    yield 'chunk1'
    yield 'chunk2'
    return 'chunk1chunk2'
  }) as unknown as AIProvider['stream']
  mockOpenAIInstance.stream = vi.fn(async function* () {
    yield 'chunk1'
    yield 'chunk2'
    return 'chunk1chunk2'
  }) as unknown as AIProvider['stream']
}

// ══════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════

describe('background/index', () => {
  beforeEach(async () => {
    await resetChromeMocks()
  })

  // ── 1. onInstalled — context menu creation ──────────
  describe('onInstalled', () => {
    it('should register an onInstalled listener', () => {
      expect(listeners['runtime.onInstalled']).toHaveLength(1)
    })

    it('should create 6 context menus on install', () => {
      const handler = getListener('runtime.onInstalled')
      mockChrome.contextMenus.create.mockClear()
      handler()

      expect(mockChrome.contextMenus.create).toHaveBeenCalledTimes(6)
    })

    it('should create explain context menu with correct id and title', () => {
      const handler = getListener('runtime.onInstalled')
      mockChrome.contextMenus.create.mockClear()
      handler()

      expect(mockChrome.contextMenus.create).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'hchat-explain', contexts: ['selection'] }),
      )
    })

    it('should create translate context menu', () => {
      const handler = getListener('runtime.onInstalled')
      mockChrome.contextMenus.create.mockClear()
      handler()

      expect(mockChrome.contextMenus.create).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'hchat-translate', contexts: ['selection'] }),
      )
    })

    it('should create summarize context menu', () => {
      const handler = getListener('runtime.onInstalled')
      mockChrome.contextMenus.create.mockClear()
      handler()

      expect(mockChrome.contextMenus.create).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'hchat-summarize', contexts: ['selection'] }),
      )
    })

    it('should create rewrite context menu', () => {
      const handler = getListener('runtime.onInstalled')
      mockChrome.contextMenus.create.mockClear()
      handler()

      expect(mockChrome.contextMenus.create).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'hchat-rewrite', contexts: ['selection'] }),
      )
    })

    it('should create separator context menu', () => {
      const handler = getListener('runtime.onInstalled')
      mockChrome.contextMenus.create.mockClear()
      handler()

      expect(mockChrome.contextMenus.create).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'hchat-separator', type: 'separator' }),
      )
    })

    it('should create sidepanel context menu for all contexts', () => {
      const handler = getListener('runtime.onInstalled')
      mockChrome.contextMenus.create.mockClear()
      handler()

      expect(mockChrome.contextMenus.create).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'hchat-sidepanel', contexts: ['all'] }),
      )
    })
  })

  // ── 2. action.onClicked — open side panel ──────────
  describe('action.onClicked', () => {
    it('should register an action.onClicked listener', () => {
      expect(listeners['action.onClicked']).toHaveLength(1)
    })

    it('should open side panel for the active tab', async () => {
      const handler = getListener('action.onClicked')
      await handler({ id: 42 })

      expect(mockChrome.sidePanel.open).toHaveBeenCalledWith({ tabId: 42 })
    })

    it('should not open side panel when tab has no id', async () => {
      const handler = getListener('action.onClicked')
      await handler({})

      expect(mockChrome.sidePanel.open).not.toHaveBeenCalled()
    })
  })

  // ── 3. contextMenus.onClicked ──────────────────────
  describe('contextMenus.onClicked', () => {
    it('should register a contextMenus.onClicked listener', () => {
      expect(listeners['contextMenus.onClicked']).toHaveLength(1)
    })

    it('should open side panel for hchat-sidepanel menu item', async () => {
      const handler = getListener('contextMenus.onClicked')
      await handler({ menuItemId: 'hchat-sidepanel' }, { id: 10 })

      expect(mockChrome.sidePanel.open).toHaveBeenCalledWith({ tabId: 10 })
    })

    it('should not open side panel when tab is undefined for sidepanel action', async () => {
      const handler = getListener('contextMenus.onClicked')
      await handler({ menuItemId: 'hchat-sidepanel' }, undefined)

      expect(mockChrome.sidePanel.open).not.toHaveBeenCalled()
    })

    it('should send explain SELECTION_ACTION message', async () => {
      const handler = getListener('contextMenus.onClicked')
      await handler({ menuItemId: 'hchat-explain' }, { id: 10 })

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(10, {
        type: 'SELECTION_ACTION',
        action: 'explain',
      })
    })

    it('should send translate SELECTION_ACTION message', async () => {
      const handler = getListener('contextMenus.onClicked')
      await handler({ menuItemId: 'hchat-translate' }, { id: 10 })

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(10, {
        type: 'SELECTION_ACTION',
        action: 'translate',
      })
    })

    it('should send summarize SELECTION_ACTION message', async () => {
      const handler = getListener('contextMenus.onClicked')
      await handler({ menuItemId: 'hchat-summarize' }, { id: 10 })

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(10, {
        type: 'SELECTION_ACTION',
        action: 'summarize',
      })
    })

    it('should send rewrite SELECTION_ACTION message', async () => {
      const handler = getListener('contextMenus.onClicked')
      await handler({ menuItemId: 'hchat-rewrite' }, { id: 10 })

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(10, {
        type: 'SELECTION_ACTION',
        action: 'rewrite',
      })
    })

    it('should not send message for unknown menu item', async () => {
      const handler = getListener('contextMenus.onClicked')
      await handler({ menuItemId: 'unknown-item' }, { id: 10 })

      expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled()
    })

    it('should not send message when tab has no id', async () => {
      const handler = getListener('contextMenus.onClicked')
      await handler({ menuItemId: 'hchat-explain' }, {})

      expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled()
    })

    it('should not send message when tab is null', async () => {
      const handler = getListener('contextMenus.onClicked')
      await handler({ menuItemId: 'hchat-explain' }, null)

      expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled()
    })
  })

  // ── 4. runtime.onMessage ───────────────────────────
  describe('runtime.onMessage', () => {
    it('should register an onMessage listener', () => {
      expect(listeners['runtime.onMessage']).toHaveLength(1)
    })

    describe('OPEN_SIDEPANEL', () => {
      it('should query active tab and open side panel', async () => {
        mockChrome.tabs.query.mockImplementation((_q: unknown, cb: (tabs: unknown[]) => void) => {
          cb([{ id: 99 }])
        })

        const handler = getListener('runtime.onMessage')
        const reply = vi.fn()
        handler({ type: 'OPEN_SIDEPANEL' }, {}, reply)

        // tabs.query is async via callback
        await vi.waitFor(() => {
          expect(mockChrome.tabs.query).toHaveBeenCalledWith(
            { active: true, currentWindow: true },
            expect.any(Function),
          )
        })
      })

      it('should open side panel for the queried tab', async () => {
        mockChrome.tabs.query.mockImplementation((_q: unknown, cb: (tabs: unknown[]) => void) => {
          cb([{ id: 77 }])
        })

        const handler = getListener('runtime.onMessage')
        handler({ type: 'OPEN_SIDEPANEL' }, {}, vi.fn())

        await vi.waitFor(() => {
          expect(mockChrome.sidePanel.open).toHaveBeenCalledWith({ tabId: 77 })
        })
      })
    })

    describe('CONFIG_UPDATED', () => {
      it('should save config to storage', () => {
        const handler = getListener('runtime.onMessage')
        const config = { aws: { region: 'us-west-2' } }
        handler({ type: 'CONFIG_UPDATED', config }, {}, vi.fn())

        expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
          [SK.CONFIG]: config,
        })
      })
    })

    describe('SAVE_HIGHLIGHT', () => {
      it('should save highlight and reply with result', async () => {
        mockChrome.storage.local.get.mockResolvedValue({ [SK.HIGHLIGHTS]: [] })

        const handler = getListener('runtime.onMessage')
        const reply = vi.fn()
        const data = {
          text: 'test',
          url: 'https://example.com',
          title: 'Test',
          xpath: '/html/body/p[1]',
          textOffset: 0,
          color: 'yellow',
          tags: [],
        }

        const result = handler({ type: 'SAVE_HIGHLIGHT', data }, {}, reply)

        // Should return true for async response
        expect(result).toBe(true)

        await vi.waitFor(() => {
          expect(mockChrome.storage.local.set).toHaveBeenCalled()
        })
      })

      it('should generate id and timestamps for new highlight', async () => {
        mockChrome.storage.local.get.mockResolvedValue({})

        const handler = getListener('runtime.onMessage')
        const reply = vi.fn()
        const data = {
          text: 'highlighted',
          url: 'https://example.com',
          title: 'Test',
          xpath: '/html/body',
          textOffset: 0,
          color: 'green',
          tags: ['tag1'],
        }

        handler({ type: 'SAVE_HIGHLIGHT', data }, {}, reply)

        await vi.waitFor(() => {
          expect(reply).toHaveBeenCalledWith(
            expect.objectContaining({
              ok: true,
              highlight: expect.objectContaining({
                text: 'highlighted',
                id: expect.any(String),
                createdAt: expect.any(Number),
                updatedAt: expect.any(Number),
              }),
            }),
          )
        })
      })

      it('should prepend new highlight to existing list', async () => {
        const existing = [{ id: 'old', text: 'old', url: 'https://old.com' }]
        mockChrome.storage.local.get.mockResolvedValue({ [SK.HIGHLIGHTS]: existing })

        const handler = getListener('runtime.onMessage')
        const data = {
          text: 'new',
          url: 'https://new.com',
          title: 'New',
          xpath: '/html',
          textOffset: 0,
          color: 'blue',
          tags: [],
        }

        handler({ type: 'SAVE_HIGHLIGHT', data }, {}, vi.fn())

        await vi.waitFor(() => {
          const setCall = mockChrome.storage.local.set.mock.calls[0][0]
          const highlights = setCall[SK.HIGHLIGHTS]
          expect(highlights).toHaveLength(2)
          expect(highlights[0].text).toBe('new')
          expect(highlights[1].text).toBe('old')
        })
      })
    })

    describe('GET_HIGHLIGHTS', () => {
      it('should return highlights filtered by URL', async () => {
        const highlights = [
          { id: '1', text: 'a', url: 'https://foo.com' },
          { id: '2', text: 'b', url: 'https://bar.com' },
          { id: '3', text: 'c', url: 'https://foo.com' },
        ]
        mockChrome.storage.local.get.mockResolvedValue({ [SK.HIGHLIGHTS]: highlights })

        const handler = getListener('runtime.onMessage')
        const reply = vi.fn()
        handler({ type: 'GET_HIGHLIGHTS', url: 'https://foo.com' }, {}, reply)

        // Should return true for async response
        expect(handler({ type: 'GET_HIGHLIGHTS', url: 'https://foo.com' }, {}, reply)).toBe(true)

        await vi.waitFor(() => {
          expect(reply).toHaveBeenCalledWith({
            highlights: expect.arrayContaining([
              expect.objectContaining({ id: '1' }),
              expect.objectContaining({ id: '3' }),
            ]),
          })
        })
      })

      it('should return empty array when no highlights exist', async () => {
        mockChrome.storage.local.get.mockResolvedValue({})

        const handler = getListener('runtime.onMessage')
        const reply = vi.fn()
        handler({ type: 'GET_HIGHLIGHTS', url: 'https://empty.com' }, {}, reply)

        await vi.waitFor(() => {
          expect(reply).toHaveBeenCalledWith({ highlights: [] })
        })
      })
    })

    describe('unknown message type', () => {
      it('should reply with ok:true for unhandled message types', () => {
        const handler = getListener('runtime.onMessage')
        const reply = vi.fn()
        handler({ type: 'UNKNOWN_TYPE' }, {}, reply)

        expect(reply).toHaveBeenCalledWith({ ok: true })
      })

      it('should return true (keep channel open)', () => {
        const handler = getListener('runtime.onMessage')
        const result = handler({ type: 'SOMETHING_ELSE' }, {}, vi.fn())
        expect(result).toBe(true)
      })
    })
  })

  // ── 5. tabs.onActivated ────────────────────────────
  describe('tabs.onActivated', () => {
    it('should register a tabs.onActivated listener', () => {
      expect(listeners['tabs.onActivated']).toHaveLength(1)
    })

    it('should send UPDATE_PAGE_CONTEXT to the activated tab', async () => {
      mockChrome.tabs.sendMessage.mockResolvedValue(undefined)

      const handler = getListener('tabs.onActivated')
      await handler({ tabId: 55 })

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(55, {
        type: 'UPDATE_PAGE_CONTEXT',
      })
    })

    it('should not throw when content script is not loaded', async () => {
      mockChrome.tabs.sendMessage.mockRejectedValue(new Error('No content script'))

      const handler = getListener('tabs.onActivated')
      // Should not throw
      await expect(handler({ tabId: 99 })).resolves.toBeUndefined()
    })
  })

  // ── 6. createProviderForModel (via port streaming) ──
  describe('createProviderForModel (tested via port streaming)', () => {
    function createPortMock() {
      const portMessageListeners: ListenerCallback[] = []
      return {
        name: 'toolbar-stream',
        postMessage: vi.fn(),
        onMessage: {
          addListener: vi.fn((cb: ListenerCallback) => portMessageListeners.push(cb)),
        },
        onDisconnect: { addListener: vi.fn() },
        _triggerMessage: (msg: unknown) => {
          for (const cb of portMessageListeners) cb(msg)
        },
      }
    }

    it('should accept toolbar-stream port connections', () => {
      expect(listeners['runtime.onConnect']).toHaveLength(1)
    })

    it('should accept inline-stream port connections', () => {
      const handler = getListener('runtime.onConnect')
      const port = createPortMock()
      port.name = 'inline-stream'
      handler(port)

      expect(port.onMessage.addListener).toHaveBeenCalled()
    })

    it('should ignore ports with unrecognized names', () => {
      const handler = getListener('runtime.onConnect')
      const port = createPortMock()
      port.name = 'unknown-port'
      handler(port)

      expect(port.onMessage.addListener).not.toHaveBeenCalled()
    })

    it('should ignore messages that are not TOOLBAR_STREAM or INLINE_STREAM', async () => {
      const handler = getListener('runtime.onConnect')
      const port = createPortMock()
      handler(port)

      port._triggerMessage({ type: 'RANDOM_TYPE', model: 'gpt-4o', prompt: 'hi' })

      // Wait a tick
      await new Promise((r) => setTimeout(r, 10))
      expect(port.postMessage).not.toHaveBeenCalled()
    })

    it('should create bedrock provider for us.anthropic model', async () => {
      const { BedrockProvider } = await import('../../lib/providers/bedrock-provider')

      const handler = getListener('runtime.onConnect')
      const port = createPortMock()
      handler(port)

      mockChrome.storage.local.get.mockResolvedValue({
        [SK.CONFIG]: {
          aws: { accessKeyId: 'AKIA', secretAccessKey: 'secret', region: 'us-east-1' },
        },
      })

      port._triggerMessage({
        type: 'TOOLBAR_STREAM',
        model: 'us.anthropic.claude-sonnet-4-6',
        prompt: 'hello',
      })

      await vi.waitFor(() => {
        expect(BedrockProvider).toHaveBeenCalledWith({
          accessKeyId: 'AKIA',
          secretAccessKey: 'secret',
          region: 'us-east-1',
        })
      })
    })

    it('should create openai provider for gpt- model', async () => {
      const { OpenAIProvider } = await import('../../lib/providers/openai-provider')

      const handler = getListener('runtime.onConnect')
      const port = createPortMock()
      handler(port)

      mockChrome.storage.local.get.mockResolvedValue({
        [SK.CONFIG]: { openai: { apiKey: 'sk-test' } },
      })

      port._triggerMessage({
        type: 'TOOLBAR_STREAM',
        model: 'gpt-4o',
        prompt: 'hello',
      })

      await vi.waitFor(() => {
        expect(OpenAIProvider).toHaveBeenCalledWith('sk-test')
      })
    })

    it('should create gemini provider for gemini- model', async () => {
      const { GeminiProvider } = await import('../../lib/providers/gemini-provider')

      const handler = getListener('runtime.onConnect')
      const port = createPortMock()
      handler(port)

      mockChrome.storage.local.get.mockResolvedValue({
        [SK.CONFIG]: { gemini: { apiKey: 'gemini-key' } },
      })

      port._triggerMessage({
        type: 'TOOLBAR_STREAM',
        model: 'gemini-2.0-flash',
        prompt: 'hello',
      })

      await vi.waitFor(() => {
        expect(GeminiProvider).toHaveBeenCalledWith('gemini-key')
      })
    })

    it('should create openrouter provider for model with slash', async () => {
      const { OpenRouterProvider } = await import('../../lib/providers/openrouter-provider')

      const handler = getListener('runtime.onConnect')
      const port = createPortMock()
      handler(port)

      mockChrome.storage.local.get.mockResolvedValue({
        [SK.CONFIG]: {
          openrouter: { apiKey: 'or-key', siteUrl: 'https://test.com', siteName: 'Test' },
        },
      })

      port._triggerMessage({
        type: 'TOOLBAR_STREAM',
        model: 'meta-llama/llama-3-70b',
        prompt: 'hello',
      })

      await vi.waitFor(() => {
        expect(OpenRouterProvider).toHaveBeenCalledWith({
          apiKey: 'or-key',
          siteUrl: 'https://test.com',
          siteName: 'Test',
        })
      })
    })

    it('should create ollama provider when no other match and baseUrl configured', async () => {
      const { OllamaProvider } = await import('../../lib/providers/ollama-provider')

      const handler = getListener('runtime.onConnect')
      const port = createPortMock()
      handler(port)

      mockChrome.storage.local.get.mockResolvedValue({
        [SK.CONFIG]: { ollama: { baseUrl: 'http://localhost:11434' } },
      })

      port._triggerMessage({
        type: 'TOOLBAR_STREAM',
        model: 'llama3',
        prompt: 'hello',
      })

      await vi.waitFor(() => {
        expect(OllamaProvider).toHaveBeenCalledWith(
          expect.objectContaining({ baseUrl: 'http://localhost:11434' }),
        )
      })
    })

    it('should fallback to bedrock when model does not match any pattern', async () => {
      const { BedrockProvider } = await import('../../lib/providers/bedrock-provider')

      const handler = getListener('runtime.onConnect')
      const port = createPortMock()
      handler(port)

      mockChrome.storage.local.get.mockResolvedValue({
        [SK.CONFIG]: {
          aws: { accessKeyId: 'AKIA', secretAccessKey: 'secret', region: 'eu-west-1' },
        },
      })

      ;(BedrockProvider as ReturnType<typeof vi.fn>).mockClear()

      port._triggerMessage({
        type: 'TOOLBAR_STREAM',
        model: 'some-unknown-model',
        prompt: 'hello',
      })

      await vi.waitFor(() => {
        expect(BedrockProvider).toHaveBeenCalledWith({
          accessKeyId: 'AKIA',
          secretAccessKey: 'secret',
          region: 'eu-west-1',
        })
      })
    })

    it('should post error when no API key is configured', async () => {
      const handler = getListener('runtime.onConnect')
      const port = createPortMock()
      handler(port)

      mockChrome.storage.local.get.mockResolvedValue({ [SK.CONFIG]: {} })

      port._triggerMessage({
        type: 'TOOLBAR_STREAM',
        model: 'gpt-4o',
        prompt: 'hello',
      })

      await vi.waitFor(() => {
        expect(port.postMessage).toHaveBeenCalledWith({
          type: 'error',
          message: 'API 키가 설정되지 않았습니다',
        })
      })
    })

    it('should return null provider when no credentials at all', async () => {
      const handler = getListener('runtime.onConnect')
      const port = createPortMock()
      handler(port)

      mockChrome.storage.local.get.mockResolvedValue({})

      port._triggerMessage({
        type: 'TOOLBAR_STREAM',
        model: 'some-model',
        prompt: 'hello',
      })

      await vi.waitFor(() => {
        expect(port.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'error' }),
        )
      })
    })

    it('should stream chunks and send done message', async () => {
      const handler = getListener('runtime.onConnect')
      const port = createPortMock()
      handler(port)

      mockChrome.storage.local.get.mockResolvedValue({
        [SK.CONFIG]: { openai: { apiKey: 'sk-test' } },
      })

      port._triggerMessage({
        type: 'TOOLBAR_STREAM',
        model: 'gpt-4o',
        prompt: 'hello',
      })

      await vi.waitFor(() => {
        expect(port.postMessage).toHaveBeenCalledWith({ type: 'chunk', text: 'chunk1' })
        expect(port.postMessage).toHaveBeenCalledWith({ type: 'chunk', text: 'chunk2' })
        expect(port.postMessage).toHaveBeenCalledWith({ type: 'done' })
      })
    })

    it('should send error message when streaming throws', async () => {
      // Override the mock to throw
      mockOpenAIInstance.stream = vi.fn(async function* () {
        throw new Error('Network error')
        yield '' // unreachable, for generator type
      }) as unknown as AIProvider['stream']

      const handler = getListener('runtime.onConnect')
      const port = createPortMock()
      handler(port)

      mockChrome.storage.local.get.mockResolvedValue({
        [SK.CONFIG]: { openai: { apiKey: 'sk-test' } },
      })

      port._triggerMessage({
        type: 'TOOLBAR_STREAM',
        model: 'gpt-4o',
        prompt: 'hello',
      })

      await vi.waitFor(() => {
        expect(port.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'error', message: expect.stringContaining('Network error') }),
        )
      })

      // Restore mock
      mockOpenAIInstance.stream = vi.fn(async function* () {
        yield 'chunk1'
        yield 'chunk2'
        return 'chunk1chunk2'
      }) as unknown as AIProvider['stream']
    })

    it('should use legacy aws credentials when passed directly in message', async () => {
      const { BedrockProvider } = await import('../../lib/providers/bedrock-provider')

      const handler = getListener('runtime.onConnect')
      const port = createPortMock()
      handler(port)

      ;(BedrockProvider as ReturnType<typeof vi.fn>).mockClear()

      port._triggerMessage({
        type: 'TOOLBAR_STREAM',
        model: 'us.anthropic.claude-sonnet-4-6',
        prompt: 'hello',
        aws: { accessKeyId: 'LEGACY', secretAccessKey: 'legacy-secret', region: 'ap-northeast-2' },
      })

      await vi.waitFor(() => {
        expect(BedrockProvider).toHaveBeenCalledWith({
          accessKeyId: 'LEGACY',
          secretAccessKey: 'legacy-secret',
          region: 'ap-northeast-2',
        })
      })
    })

    it('should use default model when none specified in message', async () => {
      const handler = getListener('runtime.onConnect')
      const port = createPortMock()
      handler(port)

      mockChrome.storage.local.get.mockResolvedValue({
        [SK.CONFIG]: {
          defaultModel: 'gpt-4o',
          openai: { apiKey: 'sk-default' },
        },
      })

      port._triggerMessage({
        type: 'TOOLBAR_STREAM',
        prompt: 'hello',
      })

      await vi.waitFor(() => {
        expect(port.postMessage).toHaveBeenCalledWith({ type: 'done' })
      })
    })

    it('should use anthropic model prefix for anthropic/ models', async () => {
      const handler = getListener('runtime.onConnect')
      const port = createPortMock()
      handler(port)

      mockChrome.storage.local.get.mockResolvedValue({
        [SK.CONFIG]: {
          aws: { accessKeyId: 'AKIA', secretAccessKey: 'sec', region: 'us-east-1' },
        },
      })

      port._triggerMessage({
        type: 'TOOLBAR_STREAM',
        model: 'anthropic.claude-3-sonnet',
        prompt: 'hello',
      })

      await vi.waitFor(() => {
        // anthropic prefix matches us.anthropic || anthropic
        expect(port.postMessage).toHaveBeenCalledWith({ type: 'done' })
      })
    })

    it('should handle INLINE_STREAM type the same as TOOLBAR_STREAM', async () => {
      const handler = getListener('runtime.onConnect')
      const port = createPortMock()
      port.name = 'inline-stream'
      handler(port)

      mockChrome.storage.local.get.mockResolvedValue({
        [SK.CONFIG]: { openai: { apiKey: 'sk-inline' } },
      })

      port._triggerMessage({
        type: 'INLINE_STREAM',
        model: 'gpt-4o',
        prompt: 'inline test',
      })

      await vi.waitFor(() => {
        expect(port.postMessage).toHaveBeenCalledWith({ type: 'done' })
      })
    })

    it('should pass maxTokens from message to provider.stream', async () => {
      const handler = getListener('runtime.onConnect')
      const port = createPortMock()
      handler(port)

      mockChrome.storage.local.get.mockResolvedValue({
        [SK.CONFIG]: { openai: { apiKey: 'sk-test' } },
      })

      port._triggerMessage({
        type: 'TOOLBAR_STREAM',
        model: 'gpt-4o',
        prompt: 'hello',
        maxTokens: 2048,
      })

      await vi.waitFor(() => {
        expect(mockOpenAIInstance.stream).toHaveBeenCalledWith(
          expect.objectContaining({ maxTokens: 2048 }),
        )
      })
    })

    it('should default maxTokens to 1024 when not specified', async () => {
      const handler = getListener('runtime.onConnect')
      const port = createPortMock()
      handler(port)

      mockChrome.storage.local.get.mockResolvedValue({
        [SK.CONFIG]: { openai: { apiKey: 'sk-test' } },
      })

      port._triggerMessage({
        type: 'TOOLBAR_STREAM',
        model: 'gpt-4o',
        prompt: 'hello',
      })

      await vi.waitFor(() => {
        expect(mockOpenAIInstance.stream).toHaveBeenCalledWith(
          expect.objectContaining({ maxTokens: 1024 }),
        )
      })
    })

    it('should pass systemPrompt to provider.stream', async () => {
      const handler = getListener('runtime.onConnect')
      const port = createPortMock()
      handler(port)

      mockChrome.storage.local.get.mockResolvedValue({
        [SK.CONFIG]: { openai: { apiKey: 'sk-test' } },
      })

      port._triggerMessage({
        type: 'TOOLBAR_STREAM',
        model: 'gpt-4o',
        prompt: 'hello',
        systemPrompt: 'You are helpful',
      })

      await vi.waitFor(() => {
        expect(mockOpenAIInstance.stream).toHaveBeenCalledWith(
          expect.objectContaining({ systemPrompt: 'You are helpful' }),
        )
      })
    })
  })

  // ── 7. commands.onCommand ──────────────────────────
  describe('commands.onCommand', () => {
    it('should register a commands.onCommand listener', () => {
      expect(listeners['commands.onCommand']).toHaveLength(1)
    })

    it('should open side panel for quick-summarize command', async () => {
      mockChrome.tabs.query.mockResolvedValue([{ id: 44 }])

      const handler = getListener('commands.onCommand')
      await handler('quick-summarize')

      expect(mockChrome.sidePanel.open).toHaveBeenCalledWith({ tabId: 44 })
    })

    it('should save quick-action to storage with summarize action', async () => {
      mockChrome.tabs.query.mockResolvedValue([{ id: 44 }])

      const handler = getListener('commands.onCommand')
      await handler('quick-summarize')

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          [SK.QUICK_ACTION]: expect.objectContaining({
            action: 'summarize',
            ts: expect.any(Number),
          }),
        }),
      )
    })

    it('should not act on non-quick-summarize commands', async () => {
      const handler = getListener('commands.onCommand')
      await handler('some-other-command')

      expect(mockChrome.sidePanel.open).not.toHaveBeenCalled()
      expect(mockChrome.storage.local.set).not.toHaveBeenCalled()
    })

    it('should not open side panel when no active tab found', async () => {
      mockChrome.tabs.query.mockResolvedValue([{}])

      const handler = getListener('commands.onCommand')
      await handler('quick-summarize')

      expect(mockChrome.sidePanel.open).not.toHaveBeenCalled()
    })

    it('should query for active tab in current window', async () => {
      mockChrome.tabs.query.mockResolvedValue([{ id: 1 }])

      const handler = getListener('commands.onCommand')
      await handler('quick-summarize')

      expect(mockChrome.tabs.query).toHaveBeenCalledWith({
        active: true,
        currentWindow: true,
      })
    })
  })

  // ── 8. bedrock default region ──────────────────────
  describe('bedrock default region', () => {
    it('should use us-east-1 as default region when not specified', async () => {
      const { BedrockProvider } = await import('../../lib/providers/bedrock-provider')

      const handler = getListener('runtime.onConnect')
      const port = {
        name: 'toolbar-stream',
        postMessage: vi.fn(),
        onMessage: { addListener: vi.fn() },
        onDisconnect: { addListener: vi.fn() },
      }
      const messageListeners: ListenerCallback[] = []
      port.onMessage.addListener.mockImplementation((cb: ListenerCallback) => messageListeners.push(cb))

      handler(port)

      mockChrome.storage.local.get.mockResolvedValue({
        [SK.CONFIG]: {
          aws: { accessKeyId: 'AKIA', secretAccessKey: 'secret' },
        },
      })

      ;(BedrockProvider as ReturnType<typeof vi.fn>).mockClear()

      for (const cb of messageListeners) {
        cb({
          type: 'TOOLBAR_STREAM',
          model: 'us.anthropic.claude-sonnet-4-6',
          prompt: 'hello',
        })
      }

      await vi.waitFor(() => {
        expect(BedrockProvider).toHaveBeenCalledWith(
          expect.objectContaining({ region: 'us-east-1' }),
        )
      })
    })
  })
})
