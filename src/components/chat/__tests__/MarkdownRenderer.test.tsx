import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('../../../i18n', () => ({
  useLocale: vi.fn(() => ({
    t: (key: string) => key,
    locale: 'ko' as const,
    setLocale: vi.fn(),
  })),
}))

import { MD } from '../MarkdownRenderer'

describe('MD (MarkdownRenderer)', () => {
  describe('basic markdown rendering', () => {
    it('renders plain text', () => {
      const { container } = render(<MD text="Hello World" />)
      expect(container.textContent).toContain('Hello World')
    })

    it('renders bold text', () => {
      const { container } = render(<MD text="This is **bold** text" />)
      const strong = container.querySelector('strong')
      expect(strong).toBeTruthy()
      expect(strong?.textContent).toBe('bold')
    })

    it('renders italic text', () => {
      const { container } = render(<MD text="This is *italic* text" />)
      const em = container.querySelector('em')
      expect(em).toBeTruthy()
      expect(em?.textContent).toBe('italic')
    })

    it('renders inline code', () => {
      const { container } = render(<MD text="Use `npm install` to install" />)
      const code = container.querySelector('code')
      expect(code).toBeTruthy()
      expect(code?.textContent).toBe('npm install')
    })

    it('renders h1 heading', () => {
      const { container } = render(<MD text="# Heading 1" />)
      expect(container.querySelector('h1')).toBeTruthy()
      expect(container.textContent).toContain('Heading 1')
    })

    it('renders h2 heading', () => {
      const { container } = render(<MD text="## Heading 2" />)
      expect(container.querySelector('h2')).toBeTruthy()
      expect(container.textContent).toContain('Heading 2')
    })

    it('renders h3 heading', () => {
      const { container } = render(<MD text="### Heading 3" />)
      expect(container.querySelector('h3')).toBeTruthy()
      expect(container.textContent).toContain('Heading 3')
    })

    it('renders list items', () => {
      const { container } = render(<MD text={'- Item 1\n- Item 2'} />)
      expect(container.querySelector('ul')).toBeTruthy()
      const items = container.querySelectorAll('li')
      expect(items.length).toBe(2)
      expect(items[0].textContent).toContain('Item 1')
      expect(items[1].textContent).toContain('Item 2')
    })

    it('renders fenced code blocks', () => {
      const { container } = render(<MD text={'```javascript\nconst x = 1\n```'} />)
      const codeBlock = container.querySelector('.code-block')
      expect(codeBlock).toBeTruthy()
    })

    it('handles mixed content with code blocks', () => {
      const text = 'Before code\n```python\nprint("hi")\n```\nAfter code'
      const { container } = render(<MD text={text} />)
      expect(container.textContent).toContain('Before code')
      expect(container.textContent).toContain('print("hi")')
      expect(container.textContent).toContain('After code')
    })

    it('renders paragraphs separated by double newlines', () => {
      const { container } = render(<MD text={'First paragraph\n\nSecond paragraph'} />)
      const paragraphs = container.querySelectorAll('p')
      expect(paragraphs.length).toBe(2)
    })

    it('renders line breaks within a paragraph', () => {
      const { container } = render(<MD text={'Line 1\nLine 2\nLine 3'} />)
      const brs = container.querySelectorAll('br')
      expect(brs.length).toBe(2)
    })

    it('renders bold inside list items', () => {
      const { container } = render(<MD text="- **bold** item" />)
      const li = container.querySelector('li')
      expect(li?.querySelector('strong')?.textContent).toBe('bold')
    })

    it('renders multiple inline styles in one line', () => {
      const { container } = render(<MD text="**bold** and *italic* and `code`" />)
      expect(container.querySelector('strong')?.textContent).toBe('bold')
      expect(container.querySelector('em')?.textContent).toBe('italic')
      expect(container.querySelector('code')?.textContent).toBe('code')
    })
  })

  describe('XSS prevention', () => {
    it('blocks <script> tags — no script element created', () => {
      const { container } = render(<MD text="<script>alert(1)</script>" />)
      expect(container.querySelectorAll('script').length).toBe(0)
      // The text is HTML-escaped and rendered as visible text
      expect(container.textContent).toContain('&lt;script&gt;')
    })

    it('blocks <img onerror> — no img element created', () => {
      const { container } = render(<MD text={'<img onerror="alert(1)" src="x">'} />)
      expect(container.querySelectorAll('img').length).toBe(0)
      // The entire tag is escaped to text, no DOM element is created
      expect(container.textContent).toContain('&lt;img')
    })

    it('blocks <iframe> — no iframe element created', () => {
      const { container } = render(<MD text={'<iframe src="javascript:alert(1)">'} />)
      expect(container.querySelectorAll('iframe').length).toBe(0)
      expect(container.textContent).toContain('&lt;iframe')
    })

    it('blocks <div onmouseover> — no element with event handler', () => {
      const { container } = render(<MD text={'<div onmouseover="alert(1)">hover me</div>'} />)
      // No real div with event handler is created (only the md wrapper div exists)
      const allDivs = container.querySelectorAll('div')
      allDivs.forEach((div) => {
        expect(div.getAttribute('onmouseover')).toBeNull()
      })
      expect(container.textContent).toContain('hover me')
    })

    it('blocks data: URI — no anchor element created', () => {
      const { container } = render(<MD text={'<a href="data:text/html,<script>alert(1)</script>">click</a>'} />)
      expect(container.querySelectorAll('a').length).toBe(0)
      expect(container.textContent).toContain('click')
    })

    it('blocks <svg onload> — no svg element created', () => {
      const { container } = render(<MD text={'<svg onload="alert(1)">'} />)
      expect(container.querySelectorAll('svg').length).toBe(0)
      expect(container.textContent).toContain('&lt;svg')
    })

    it('blocks template injection {{constructor}}', () => {
      const { container } = render(<MD text={"{{constructor.constructor('alert(1)')()}}"} />)
      expect(container.querySelectorAll('script').length).toBe(0)
      expect(container.textContent).toContain('constructor')
    })

    it('blocks javascript: protocol — no anchor element created', () => {
      const { container } = render(<MD text={'<a href="javascript:void(0)">link</a>'} />)
      expect(container.querySelectorAll('a').length).toBe(0)
      expect(container.textContent).toContain('link')
    })

    it('blocks <body onload> — no body element created', () => {
      const { container } = render(<MD text={'<body onload="alert(1)">'} />)
      // No new body element should be created in the container
      const bodies = container.querySelectorAll('body')
      expect(bodies.length).toBe(0)
      expect(container.textContent).toContain('&lt;body')
    })

    it('blocks <input> — no input element created', () => {
      const { container } = render(<MD text={'<input onfocus="alert(1)" autofocus>'} />)
      expect(container.querySelectorAll('input').length).toBe(0)
      expect(container.textContent).toContain('&lt;input')
    })

    it('blocks <details> — no details element created', () => {
      const { container } = render(<MD text={'<details ontoggle="alert(1)"><summary>click</summary></details>'} />)
      expect(container.querySelectorAll('details').length).toBe(0)
      expect(container.textContent).toContain('click')
    })

    it('blocks <marquee> — no marquee element created', () => {
      const { container } = render(<MD text={'<marquee onstart="alert(1)">scroll</marquee>'} />)
      expect(container.querySelectorAll('marquee').length).toBe(0)
      expect(container.textContent).toContain('scroll')
    })

    it('blocks polyglot XSS vector — no dangerous elements created', () => {
      const { container } = render(
        <MD text={'<math><mtext><table><mglyph><style><!--</style><img src=x onerror=alert(1)>'} />
      )
      expect(container.querySelectorAll('img').length).toBe(0)
      expect(container.querySelectorAll('math').length).toBe(0)
      expect(container.querySelectorAll('style').length).toBe(0)
    })

    it('escapes HTML entities — no real HTML elements from user content', () => {
      const text = '<b>not bold</b> & "quotes"'
      const { container } = render(<MD text={text} />)
      expect(container.querySelectorAll('b').length).toBe(0)
      expect(container.textContent).toContain('&lt;b&gt;')
    })

    it('no dangerouslySetInnerHTML in output DOM', () => {
      const { container } = render(<MD text="safe text **bold** *italic*" />)
      // The implementation uses React elements, not dangerouslySetInnerHTML.
      // Verify rendered output has proper elements.
      expect(container.querySelector('strong')?.textContent).toBe('bold')
      expect(container.querySelector('em')?.textContent).toBe('italic')
    })

    it('blocks XSS inside markdown syntax — bold/italic with malicious content', () => {
      const { container } = render(
        <MD text={'**<script>alert(1)</script>** and *<img src=x onerror=alert(1)>*'} />
      )
      expect(container.querySelectorAll('script').length).toBe(0)
      expect(container.querySelectorAll('img').length).toBe(0)
      expect(container.querySelector('strong')).toBeTruthy()
      expect(container.querySelector('em')).toBeTruthy()
    })
  })
})
