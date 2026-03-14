import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { escapeRegex } from '../../lib/messageSearch'

/**
 * highlightMatchElements is a local function in MessageSearchModal.
 * We replicate the same logic here for isolated XSS testing.
 */
function highlightMatchElements(snippet: string, query: string): React.ReactNode[] {
  if (!query.trim()) return [snippet]
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi')
  const parts = snippet.split(regex)
  return parts.map((part, i) =>
    regex.test(part) ? React.createElement('mark', { key: i }, part) : part
  )
}

function renderHighlight(snippet: string, query: string) {
  const nodes = highlightMatchElements(snippet, query)
  return render(React.createElement('div', { 'data-testid': 'hl' }, ...nodes))
}

describe('highlightMatchElements XSS prevention', () => {
  it('should not inject HTML tags from snippet', () => {
    const { getByTestId } = renderHighlight('<script>alert("xss")</script>', 'alert')
    const el = getByTestId('hl')
    // The script tag should be rendered as text, not actual HTML
    expect(el.innerHTML).not.toContain('<script>')
    expect(el.innerHTML).toContain('&lt;script&gt;')
    expect(el.querySelector('script')).toBeNull()
    // The match should still be highlighted
    expect(el.querySelector('mark')?.textContent).toBe('alert')
  })

  it('should not inject HTML from query', () => {
    const { getByTestId } = renderHighlight('hello world', '<img src=x onerror=alert(1)>')
    const el = getByTestId('hl')
    expect(el.querySelector('img')).toBeNull()
    expect(el.textContent).toBe('hello world')
  })

  it('should safely handle special regex characters in query', () => {
    const { getByTestId } = renderHighlight('price is $100.00', '$100.00')
    const el = getByTestId('hl')
    expect(el.querySelector('mark')?.textContent).toBe('$100.00')
  })

  it('should handle HTML entities in snippet', () => {
    const { getByTestId } = renderHighlight('a &amp; b <div> test', 'test')
    const el = getByTestId('hl')
    expect(el.querySelector('mark')?.textContent).toBe('test')
    expect(el.querySelector('div')).toBeNull()
    expect(el.textContent).toContain('a &amp; b <div>')
  })

  it('should return plain text for empty query', () => {
    const nodes = highlightMatchElements('some text', '')
    expect(nodes).toEqual(['some text'])
  })

  it('should handle case-insensitive matching', () => {
    const { getByTestId } = renderHighlight('Hello HELLO hello', 'hello')
    const el = getByTestId('hl')
    const marks = el.querySelectorAll('mark')
    expect(marks.length).toBe(3)
    expect(marks[0].textContent).toBe('Hello')
    expect(marks[1].textContent).toBe('HELLO')
    expect(marks[2].textContent).toBe('hello')
  })
})
