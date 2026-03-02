import { describe, it, expect, vi } from 'vitest'
import { detectLanguage } from '../../../lib/detectLanguage'

vi.mock('../../../i18n', () => ({
  useLocale: vi.fn(() => ({
    t: (key: string) => key,
    locale: 'ko' as const,
    setLocale: vi.fn(),
  })),
}))

describe('detectLanguage', () => {
  it('detects JavaScript', () => {
    expect(detectLanguage('import React from "react"')).toBe('javascript')
    expect(detectLanguage('const x = 1')).toBe('javascript')
    expect(detectLanguage('export default App')).toBe('javascript')
    expect(detectLanguage('function hello() {}')).toBe('javascript')
  })

  it('detects Python', () => {
    expect(detectLanguage('def hello():')).toBe('python')
    expect(detectLanguage('print("hello")')).toBe('python')
    expect(detectLanguage('if __name__ == "__main__":')).toBe('python')
  })

  it('detects HTML', () => {
    expect(detectLanguage('<div>Hello</div>')).toBe('html')
    expect(detectLanguage('<p>text</p>')).toBe('html')
  })

  it('detects JSON', () => {
    expect(detectLanguage('{"name": "test"}')).toBe('json')
  })

  it('detects SQL', () => {
    expect(detectLanguage('SELECT * FROM users')).toBe('sql')
    expect(detectLanguage('INSERT INTO table VALUES')).toBe('sql')
  })

  it('detects C', () => {
    expect(detectLanguage('#include <stdio.h>')).toBe('c')
    expect(detectLanguage('int main() {')).toBe('c')
  })

  it('detects Go', () => {
    expect(detectLanguage('package main')).toBe('go')
    expect(detectLanguage('func main() {')).toBe('go')
  })

  it('detects CSS', () => {
    // Regex expects `word { ... : ...; }` pattern
    expect(detectLanguage('body {\n  color: red;\n}')).toBe('css')
  })

  it('returns "code" for unknown', () => {
    expect(detectLanguage('some random text')).toBe('code')
  })
})
