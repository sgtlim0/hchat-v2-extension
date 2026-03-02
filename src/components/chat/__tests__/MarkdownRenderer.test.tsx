import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../../i18n', () => ({
  useLocale: vi.fn(() => ({
    t: (key: string) => key,
    locale: 'ko' as const,
    setLocale: vi.fn(),
  })),
}))

import { MD } from '../MarkdownRenderer'

describe('MD (MarkdownRenderer)', () => {
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

  it('renders headings', () => {
    // Each heading on its own line to avoid nesting issues in dangerouslySetInnerHTML
    const { container } = render(<MD text="# Heading 1" />)
    expect(container.querySelector('h1')).toBeTruthy()
    expect(container.textContent).toContain('Heading 1')
  })

  it('renders list items', () => {
    const { container } = render(<MD text="- Item 1\n- Item 2" />)
    // The simple MD renderer wraps <li> in <ul>
    expect(container.querySelector('li')).toBeTruthy()
    expect(container.textContent).toContain('Item 1')
    expect(container.textContent).toContain('Item 2')
  })

  it('renders fenced code blocks', () => {
    const { container } = render(<MD text={'```javascript\nconst x = 1\n```'} />)
    // Should render a CodeBlock component with the code
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

  it('escapes HTML in text parts', () => {
    const { container } = render(<MD text="<script>alert('xss')</script>" />)
    const scripts = container.querySelectorAll('script')
    expect(scripts.length).toBe(0)
  })
})
