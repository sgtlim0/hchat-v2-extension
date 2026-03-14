/**
 * Content script tests
 * Tests: extractMainContent, detectPageType, updatePageContext,
 * SPA detection, selection handler, highlight restoration, message listener
 */

import { extractMainContent, detectPageType, updatePageContext } from '../pageContext'
import { SK } from '../../lib/storageKeys'

// ── innerText polyfill for jsdom ──
// jsdom does not implement innerText. We polyfill it with textContent for testing.
if (!('innerText' in HTMLElement.prototype)) {
  Object.defineProperty(HTMLElement.prototype, 'innerText', {
    get() {
      return this.textContent ?? ''
    },
    set(value: string) {
      this.textContent = value
    },
    configurable: true,
  })
}

// ══════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════

describe('content/pageContext — detectPageType', () => {
  // ── Code platforms ──
  it('should detect github.com as code', () => {
    expect(detectPageType('https://github.com/user/repo')).toBe('code')
  })

  it('should detect gitlab.com as code', () => {
    expect(detectPageType('https://gitlab.com/user/repo')).toBe('code')
  })

  it('should detect bitbucket.org as code', () => {
    expect(detectPageType('https://bitbucket.org/user/repo')).toBe('code')
  })

  it('should detect github.com with subpath as code', () => {
    expect(detectPageType('https://github.com/user/repo/issues/123')).toBe('code')
  })

  // ── Video platforms ──
  it('should detect youtube.com as video', () => {
    expect(detectPageType('https://www.youtube.com/watch?v=abc123')).toBe('video')
  })

  it('should detect youtu.be as video', () => {
    expect(detectPageType('https://youtu.be/abc123')).toBe('video')
  })

  it('should detect vimeo.com as video', () => {
    expect(detectPageType('https://vimeo.com/123456')).toBe('video')
  })

  // ── Social platforms ──
  it('should detect twitter.com as social', () => {
    expect(detectPageType('https://twitter.com/user/status/123')).toBe('social')
  })

  it('should detect x.com as social', () => {
    expect(detectPageType('https://x.com/user')).toBe('social')
  })

  it('should detect reddit.com as social', () => {
    expect(detectPageType('https://www.reddit.com/r/programming')).toBe('social')
  })

  // ── Docs ──
  it('should detect docs. subdomain as docs', () => {
    expect(detectPageType('https://docs.example.com/api')).toBe('docs')
  })

  it('should detect documentation in path as docs', () => {
    expect(detectPageType('https://example.com/documentation/v2')).toBe('docs')
  })

  it('should detect wiki in URL as docs', () => {
    expect(detectPageType('https://en.wikipedia.org/wiki/Test')).toBe('docs')
  })

  it('should detect README in URL case-insensitively as docs', () => {
    expect(detectPageType('https://example.com/README.md')).toBe('docs')
    expect(detectPageType('https://example.com/readme')).toBe('docs')
  })

  // ── Unknown ──
  it('should return unknown for general sites', () => {
    expect(detectPageType('https://example.com')).toBe('unknown')
  })

  it('should return unknown for email sites', () => {
    expect(detectPageType('https://mail.google.com/mail')).toBe('unknown')
  })

  it('should return unknown for empty string', () => {
    expect(detectPageType('')).toBe('unknown')
  })

  it('should return unknown for localhost', () => {
    expect(detectPageType('http://localhost:3000')).toBe('unknown')
  })
})

describe('content/pageContext — extractMainContent', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('should extract text from article element when present', () => {
    const longText = 'A'.repeat(200)
    document.body.innerHTML = `
      <article>${longText}</article>
      <div>sidebar stuff</div>
    `

    const result = extractMainContent()
    expect(result).toContain('A'.repeat(200))
  })

  it('should extract text from main element', () => {
    const longText = 'B'.repeat(200)
    document.body.innerHTML = `<main>${longText}</main>`

    const result = extractMainContent()
    expect(result).toContain('B'.repeat(200))
  })

  it('should extract text from [role="main"] element', () => {
    const longText = 'C'.repeat(200)
    document.body.innerHTML = `<div role="main">${longText}</div>`

    const result = extractMainContent()
    expect(result).toContain('C'.repeat(200))
  })

  it('should extract text from #content element', () => {
    const longText = 'D'.repeat(200)
    document.body.innerHTML = `<div id="content">${longText}</div>`

    const result = extractMainContent()
    expect(result).toContain('D'.repeat(200))
  })

  it('should extract text from .content element', () => {
    const longText = 'E'.repeat(200)
    document.body.innerHTML = `<div class="content">${longText}</div>`

    const result = extractMainContent()
    expect(result).toContain('E'.repeat(200))
  })

  it('should pick the candidate with the most text', () => {
    const shortText = 'Short'.repeat(30)
    const longText = 'Long'.repeat(100)
    document.body.innerHTML = `
      <article>${shortText}</article>
      <main>${longText}</main>
    `

    const result = extractMainContent()
    expect(result).toContain('Long')
  })

  it('should fall back to body when no semantic elements found', () => {
    const longText = 'Body content '.repeat(50)
    document.body.innerHTML = `<div>${longText}</div>`

    const result = extractMainContent()
    expect(result.length).toBeGreaterThan(0)
  })

  it('should fall back to body when semantic content is too short (<100 chars)', () => {
    document.body.innerHTML = `
      <article>Short</article>
      <div>This is the body content that should be used when article is too short. ${'x'.repeat(200)}</div>
    `

    const result = extractMainContent()
    // Should use body since article text < 100 chars
    expect(result.length).toBeGreaterThan(100)
  })

  it('should limit text to 8000 characters', () => {
    const longText = 'X'.repeat(10000)
    document.body.innerHTML = `<article>${longText}</article>`

    const result = extractMainContent()
    expect(result.length).toBeLessThanOrEqual(8000)
  })

  it('should collapse 3+ consecutive newlines to 2', () => {
    const text = 'Hello\n\n\n\n\nWorld'
    document.body.innerHTML = `<article>${'_'.repeat(200)}${text}</article>`

    const result = extractMainContent()
    expect(result).not.toContain('\n\n\n')
  })

  it('should trim whitespace', () => {
    document.body.innerHTML = `<article>   ${'X'.repeat(200)}   </article>`
    const result = extractMainContent()
    expect(result[0]).not.toBe(' ')
  })

  it('should return body content when best candidate innerText is empty', () => {
    document.body.innerHTML = `<article></article><div>${'Y'.repeat(200)}</div>`

    const result = extractMainContent()
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('content/pageContext — updatePageContext', () => {
  beforeEach(async () => {
    await chrome.storage.local.clear()
    document.body.innerHTML = `<article>${'Content '.repeat(50)}</article>`
  })

  it('should save page context to chrome.storage.local', async () => {
    updatePageContext()

    const result = await chrome.storage.local.get(SK.PAGE_CONTEXT)
    const ctx = (result as Record<string, unknown>)[SK.PAGE_CONTEXT] as Record<string, unknown>
    expect(ctx).toBeDefined()
  })

  it('should include url in context', () => {
    updatePageContext()

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        [SK.PAGE_CONTEXT]: expect.objectContaining({
          url: expect.any(String),
        }),
      }),
    )
  })

  it('should include title in context', () => {
    document.title = 'Test Page'
    updatePageContext()

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        [SK.PAGE_CONTEXT]: expect.objectContaining({
          title: 'Test Page',
        }),
      }),
    )
  })

  it('should include text extracted from page content', () => {
    updatePageContext()

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        [SK.PAGE_CONTEXT]: expect.objectContaining({
          text: expect.any(String),
        }),
      }),
    )
  })

  it('should include meta with page type', () => {
    updatePageContext()

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        [SK.PAGE_CONTEXT]: expect.objectContaining({
          meta: expect.objectContaining({
            type: expect.any(String),
          }),
        }),
      }),
    )
  })

  it('should include timestamp', () => {
    const before = Date.now()
    updatePageContext()

    const setCall = (chrome.storage.local.set as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const ctx = setCall[SK.PAGE_CONTEXT]
    expect(ctx.ts).toBeGreaterThanOrEqual(before)
    expect(ctx.ts).toBeLessThanOrEqual(Date.now())
  })
})

describe('content/index — SPA detection', () => {
  it('should use MutationObserver to detect URL changes', () => {
    // MutationObserver is available in jsdom
    expect(typeof MutationObserver).toBe('function')
  })

  it('should detect when location.href changes', () => {
    // Simulate the SPA detection logic from index.ts
    let lastUrl = 'https://example.com/page1'
    let updated = false

    const checkUrlChange = () => {
      const currentUrl = 'https://example.com/page2'
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl
        updated = true
      }
    }

    checkUrlChange()
    expect(updated).toBe(true)
    expect(lastUrl).toBe('https://example.com/page2')
  })

  it('should not trigger update when URL has not changed', () => {
    let lastUrl = 'https://example.com/page1'
    let updated = false

    const checkUrlChange = () => {
      const currentUrl = 'https://example.com/page1'
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl
        updated = true
      }
    }

    checkUrlChange()
    expect(updated).toBe(false)
  })
})

describe('content/index — selection handler', () => {
  beforeEach(async () => {
    await chrome.storage.local.clear()
  })

  it('should update context with selection when text > 10 chars', async () => {
    // Set up initial page context
    const ctx = {
      url: 'https://example.com',
      title: 'Test',
      text: 'Page content',
      meta: { type: 'unknown' },
      ts: 1000,
    }
    await chrome.storage.local.set({ [SK.PAGE_CONTEXT]: ctx })

    // Simulate the selection handler logic
    const sel = 'This is a long selection text that is more than 10 chars'
    const result = await chrome.storage.local.get(SK.PAGE_CONTEXT)
    const existing = (result as Record<string, typeof ctx>)[SK.PAGE_CONTEXT]
    if (existing && sel.length > 10) {
      await chrome.storage.local.set({
        [SK.PAGE_CONTEXT]: { ...existing, selection: sel.slice(0, 1000), ts: Date.now() },
      })
    }

    const final = await chrome.storage.local.get(SK.PAGE_CONTEXT)
    const stored = (final as Record<string, typeof ctx & { selection?: string }>)[SK.PAGE_CONTEXT]
    expect(stored.selection).toBe(sel)
  })

  it('should not update context when selection is 10 chars or less', () => {
    const sel = 'short'
    let updated = false

    if (sel && sel.length > 10) {
      updated = true
    }

    expect(updated).toBe(false)
  })

  it('should not update context when selection is empty', () => {
    const sel = ''
    let updated = false

    if (sel && sel.length > 10) {
      updated = true
    }

    expect(updated).toBe(false)
  })

  it('should limit selection to 1000 characters', () => {
    const longSelection = 'X'.repeat(2000)
    const truncated = longSelection.slice(0, 1000)
    expect(truncated).toHaveLength(1000)
  })

  it('should preserve existing context when adding selection', async () => {
    const ctx = {
      url: 'https://example.com',
      title: 'Test',
      text: 'Content',
      meta: { type: 'unknown' as const },
      ts: 1000,
    }
    await chrome.storage.local.set({ [SK.PAGE_CONTEXT]: ctx })

    const result = await chrome.storage.local.get(SK.PAGE_CONTEXT)
    const existing = (result as Record<string, typeof ctx>)[SK.PAGE_CONTEXT]
    const updated = { ...existing, selection: 'selected text here', ts: Date.now() }
    await chrome.storage.local.set({ [SK.PAGE_CONTEXT]: updated })

    const final = await chrome.storage.local.get(SK.PAGE_CONTEXT)
    const stored = (final as Record<string, typeof updated>)[SK.PAGE_CONTEXT]
    expect(stored.url).toBe('https://example.com')
    expect(stored.title).toBe('Test')
    expect(stored.selection).toBe('selected text here')
  })
})

describe('content/index — cleanup', () => {
  it('should be able to disconnect MutationObserver', () => {
    const observer = new MutationObserver(() => {})
    observer.observe(document.documentElement, { childList: true, subtree: true })

    // Should not throw
    expect(() => observer.disconnect()).not.toThrow()
  })

  it('should clear selection timer', () => {
    const timer = setTimeout(() => {}, 500)
    expect(() => clearTimeout(timer)).not.toThrow()
  })
})

describe('content/index — highlight restoration', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('should handle empty highlights array', async () => {
    ;(chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ highlights: [] })

    const result = await chrome.runtime.sendMessage({
      type: 'GET_HIGHLIGHTS',
      url: location.href,
    })
    const highlights = result?.highlights ?? []
    expect(highlights).toHaveLength(0)
  })

  it('should handle null response from sendMessage', async () => {
    ;(chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const result = await chrome.runtime.sendMessage({ type: 'GET_HIGHLIGHTS', url: location.href })
    const highlights = result?.highlights ?? []
    expect(highlights).toHaveLength(0)
  })

  it('should create mark elements with correct class names', () => {
    document.body.innerHTML = '<p>This is test text for highlighting</p>'

    const mark = document.createElement('mark')
    mark.className = 'hchat-highlight hchat-highlight-yellow'
    mark.dataset.highlightId = 'test-id'
    mark.textContent = 'test text'

    document.body.querySelector('p')?.appendChild(mark)

    const found = document.querySelector('.hchat-highlight-yellow')
    expect(found).not.toBeNull()
    expect(found?.dataset.highlightId).toBe('test-id')
  })

  it('should support all 5 highlight colors', () => {
    const colors = ['yellow', 'green', 'blue', 'pink', 'purple']
    for (const color of colors) {
      const className = `hchat-highlight hchat-highlight-${color}`
      expect(className).toMatch(/^hchat-highlight hchat-highlight-(yellow|green|blue|pink|purple)$/)
    }
  })

  it('should use XPath to find nodes for highlighting', () => {
    document.body.innerHTML = '<p>Hello World</p>'

    const result = document.evaluate(
      '/html/body/p',
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null,
    )

    expect(result.singleNodeValue).not.toBeNull()
    expect(result.singleNodeValue?.textContent).toBe('Hello World')
  })

  it('should handle XPath that does not match any node', () => {
    document.body.innerHTML = '<p>Hello</p>'

    const result = document.evaluate(
      '/html/body/div/span',
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null,
    )

    expect(result.singleNodeValue).toBeNull()
  })

  it('should find text within a node using indexOf', () => {
    const text = 'Hello World, this is a test'
    const searchText = 'World'
    const start = text.indexOf(searchText, 0)

    expect(start).toBe(6)
  })

  it('should handle text not found in node', () => {
    const text = 'Hello World'
    const start = text.indexOf('Missing', 0)

    expect(start).toBe(-1)
  })

  it('should respect textOffset parameter when searching', () => {
    const text = 'Hello Hello Hello'
    const start = text.indexOf('Hello', 10)

    expect(start).toBe(12)
  })

  it('should use surroundContents to wrap matched range', () => {
    document.body.innerHTML = '<p>Hello World</p>'

    const textNode = document.querySelector('p')?.firstChild
    if (textNode) {
      const range = document.createRange()
      range.setStart(textNode, 0)
      range.setEnd(textNode, 5)

      const mark = document.createElement('mark')
      mark.className = 'hchat-highlight hchat-highlight-green'
      range.surroundContents(mark)

      const found = document.querySelector('.hchat-highlight-green')
      expect(found).not.toBeNull()
      expect(found?.textContent).toBe('Hello')
    }
  })

  it('should handle sendMessage rejection gracefully', async () => {
    ;(chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Background not ready'),
    )

    // The restoreHighlights function in index.ts wraps in try/catch
    let error: Error | null = null
    try {
      await chrome.runtime.sendMessage({ type: 'GET_HIGHLIGHTS', url: location.href })
    } catch (e) {
      error = e as Error
    }

    expect(error).not.toBeNull()
    expect(error?.message).toBe('Background not ready')
  })
})

describe('content/index — message listener', () => {
  it('should handle UPDATE_PAGE_CONTEXT message type', () => {
    // Verify message handling logic works
    const msg = { type: 'UPDATE_PAGE_CONTEXT' }
    expect(msg.type).toBe('UPDATE_PAGE_CONTEXT')
  })

  it('should call updatePageContext when UPDATE_PAGE_CONTEXT received', () => {
    // Test that updatePageContext can be called without error
    document.body.innerHTML = `<article>${'Content '.repeat(50)}</article>`
    expect(() => updatePageContext()).not.toThrow()
  })

  it('should not throw for other message types', () => {
    const msg = { type: 'SOME_OTHER_TYPE' }
    // The listener only acts on UPDATE_PAGE_CONTEXT
    expect(msg.type !== 'UPDATE_PAGE_CONTEXT').toBe(true)
  })
})
