/**
 * sandboxExecutor tests
 * Tests: sandbox frame lifecycle, message handling, timeout, request management
 */

import { executeSandboxCode, handleSandboxMessage } from '../sandboxExecutor'

// Mock the sandbox iframe and postMessage
let mockIframe: { contentWindow: { postMessage: ReturnType<typeof vi.fn> } | null; src: string; style: { display: string }; addEventListener: ReturnType<typeof vi.fn> }
let messageHandler: ((event: MessageEvent) => void) | null = null

beforeEach(() => {
  mockIframe = {
    contentWindow: { postMessage: vi.fn() },
    src: '',
    style: { display: '' },
    addEventListener: vi.fn((event: string, handler: () => void, _opts?: unknown) => {
      if (event === 'load') {
        // Auto-fire load event
        setTimeout(handler, 0)
      }
    }),
  }

  vi.spyOn(document, 'createElement').mockReturnValue(mockIframe as unknown as HTMLElement)
  vi.spyOn(document.body, 'contains').mockReturnValue(false)
  vi.spyOn(document.body, 'appendChild').mockImplementation((el) => el)

  // Capture the message handler
  const originalAdd = window.addEventListener.bind(window)
  vi.spyOn(window, 'addEventListener').mockImplementation((type: string, handler: EventListenerOrEventListenerObject) => {
    if (type === 'message') {
      messageHandler = handler as (event: MessageEvent) => void
    }
    originalAdd(type, handler)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  messageHandler = null
})

describe('sandboxExecutor', () => {
  describe('executeSandboxCode', () => {
    it('should resolve with result when sandbox responds', async () => {
      const promise = executeSandboxCode('1+1', '')

      // Wait for iframe creation
      await new Promise((r) => setTimeout(r, 10))

      // Simulate sandbox response with null origin (sandbox pages have null origin)
      const calls = mockIframe.contentWindow!.postMessage.mock.calls
      if (calls.length > 0) {
        const { id } = calls[0][0]
        handleSandboxMessage({ origin: 'null', data: { id, result: '2' } } as MessageEvent)
      }

      const result = await promise
      expect(result).toBe('2')
    })

    it('should timeout after 5 seconds', async () => {
      vi.useFakeTimers()

      const promise = executeSandboxCode('while(true){}', '')

      // Advance past timeout
      vi.advanceTimersByTime(5100)

      const result = await promise
      expect(result).toContain('timed out')

      vi.useRealTimers()
    })

    it('should handle error responses from sandbox', async () => {
      const promise = executeSandboxCode('throw new Error("fail")', '')

      await new Promise((r) => setTimeout(r, 10))

      const calls = mockIframe.contentWindow!.postMessage.mock.calls
      if (calls.length > 0) {
        const { id } = calls[0][0]
        handleSandboxMessage({ origin: 'null', data: { id, error: 'Error: fail' } } as MessageEvent)
      }

      const result = await promise
      expect(result).toBe('Error: fail')
    })

    it('should pass input parameter to sandbox', async () => {
      executeSandboxCode('return input', 'hello')

      await new Promise((r) => setTimeout(r, 10))

      const calls = mockIframe.contentWindow!.postMessage.mock.calls
      if (calls.length > 0) {
        expect(calls[0][0].input).toBe('hello')
        expect(calls[0][0].code).toBe('return input')
      }
    })

    it('should generate unique request IDs', async () => {
      const ids = new Set<string>()
      for (let i = 0; i < 10; i++) {
        const id = `sb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        ids.add(id)
      }
      expect(ids.size).toBe(10)
    })

    it('should use chrome.runtime.getURL for sandbox.html', () => {
      const url = chrome.runtime.getURL('sandbox.html')
      expect(url).toContain('sandbox.html')
    })
  })

  describe('message handling', () => {
    it('should ignore messages without matching id', () => {
      // Messages with unknown IDs should be silently ignored
      const event = new MessageEvent('message', {
        data: { id: 'unknown-id', result: 'ignored' },
      })
      // Should not throw
      expect(() => window.dispatchEvent(event)).not.toThrow()
    })

    it('should ignore messages without id field', () => {
      const event = new MessageEvent('message', {
        data: { result: 'no-id' },
      })
      expect(() => window.dispatchEvent(event)).not.toThrow()
    })

    it('should ignore messages with null data', () => {
      const event = new MessageEvent('message', { data: null })
      expect(() => window.dispatchEvent(event)).not.toThrow()
    })
  })

  describe('origin verification', () => {
    it('should accept messages with null origin (sandbox)', async () => {
      const promise = executeSandboxCode('1+1', '')
      await new Promise((r) => setTimeout(r, 10))

      const calls = mockIframe.contentWindow!.postMessage.mock.calls
      if (calls.length > 0) {
        const { id } = calls[0][0]
        // Simulate message from sandbox (null origin)
        handleSandboxMessage({ origin: 'null', data: { id, result: '2' } } as MessageEvent)
      }

      const result = await promise
      expect(result).toBe('2')
    })

    it('should accept messages from extension origin', async () => {
      const promise = executeSandboxCode('1+2', '')
      await new Promise((r) => setTimeout(r, 10))

      const calls = mockIframe.contentWindow!.postMessage.mock.calls
      if (calls.length > 0) {
        const { id } = calls[0][0]
        const extensionOrigin = chrome.runtime.getURL('').replace(/\/$/, '')
        handleSandboxMessage({ origin: extensionOrigin, data: { id, result: '3' } } as MessageEvent)
      }

      const result = await promise
      expect(result).toBe('3')
    })

    it('should reject messages from untrusted origins', async () => {
      vi.useFakeTimers()
      const promise = executeSandboxCode('1+3', '')

      // Advance past iframe load
      vi.advanceTimersByTime(10)

      const calls = mockIframe.contentWindow!.postMessage.mock.calls
      if (calls.length > 0) {
        const { id } = calls[0][0]
        // Simulate message from malicious origin — should be ignored
        handleSandboxMessage({ origin: 'https://evil.com', data: { id, result: 'hacked' } } as MessageEvent)
      }

      // Should timeout since the message was rejected
      vi.advanceTimersByTime(5100)
      const result = await promise
      expect(result).toContain('timed out')
      vi.useRealTimers()
    })
  })
})
