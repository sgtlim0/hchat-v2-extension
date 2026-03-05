import { describe, it, expect, vi } from 'vitest'

vi.mock('../../i18n', () => ({
  t: vi.fn((key: string) => key),
}))

import { getXPathForElement } from '../bookmarks'

describe('getXPathForElement', () => {
  it('returns "/" for document node', () => {
    expect(getXPathForElement(document)).toBe('/')
  })

  it('returns xpath for a single element child of documentElement', () => {
    const div = document.createElement('div')
    document.documentElement.appendChild(div)

    const result = getXPathForElement(div)
    expect(result).toBe('/div[1]')

    document.documentElement.removeChild(div)
  })

  it('returns xpath for nested elements', () => {
    const container = document.createElement('div')
    const child = document.createElement('span')
    container.appendChild(child)
    document.documentElement.appendChild(container)

    const result = getXPathForElement(child)
    expect(result).toBe('/div[1]/span[1]')

    document.documentElement.removeChild(container)
  })

  it('increments index for same-named siblings', () => {
    const container = document.createElement('div')
    const p1 = document.createElement('p')
    const p2 = document.createElement('p')
    const p3 = document.createElement('p')
    container.appendChild(p1)
    container.appendChild(p2)
    container.appendChild(p3)
    document.documentElement.appendChild(container)

    expect(getXPathForElement(p1)).toBe('/div[1]/p[1]')
    expect(getXPathForElement(p2)).toBe('/div[1]/p[2]')
    expect(getXPathForElement(p3)).toBe('/div[1]/p[3]')

    document.documentElement.removeChild(container)
  })

  it('does not increment index for differently-named siblings', () => {
    const container = document.createElement('div')
    const span = document.createElement('span')
    const p = document.createElement('p')
    container.appendChild(span)
    container.appendChild(p)
    document.documentElement.appendChild(container)

    expect(getXPathForElement(p)).toBe('/div[1]/p[1]')

    document.documentElement.removeChild(container)
  })

  it('handles text nodes with text() xpath', () => {
    const container = document.createElement('div')
    const textNode = document.createTextNode('hello')
    container.appendChild(textNode)
    document.documentElement.appendChild(container)

    const result = getXPathForElement(textNode)
    expect(result).toBe('/div[1]/text()[1]')

    document.documentElement.removeChild(container)
  })

  it('increments text node index for multiple text node siblings', () => {
    const container = document.createElement('div')
    const text1 = document.createTextNode('first')
    const text2 = document.createTextNode('second')
    container.appendChild(text1)
    container.appendChild(text2)
    document.documentElement.appendChild(container)

    expect(getXPathForElement(text1)).toBe('/div[1]/text()[1]')
    expect(getXPathForElement(text2)).toBe('/div[1]/text()[2]')

    document.documentElement.removeChild(container)
  })

  it('does not count non-text siblings when indexing text nodes', () => {
    const container = document.createElement('div')
    const span = document.createElement('span')
    const textNode = document.createTextNode('after span')
    container.appendChild(span)
    container.appendChild(textNode)
    document.documentElement.appendChild(container)

    const result = getXPathForElement(textNode)
    expect(result).toBe('/div[1]/text()[1]')

    document.documentElement.removeChild(container)
  })

  it('returns xpath for documentElement itself', () => {
    // documentElement is the while-loop stop condition, so it returns empty parts
    const result = getXPathForElement(document.documentElement)
    expect(result).toBe('/')
  })

  it('handles deeply nested structures', () => {
    const div = document.createElement('div')
    const ul = document.createElement('ul')
    const li = document.createElement('li')
    const a = document.createElement('a')
    div.appendChild(ul)
    ul.appendChild(li)
    li.appendChild(a)
    document.documentElement.appendChild(div)

    expect(getXPathForElement(a)).toBe('/div[1]/ul[1]/li[1]/a[1]')

    document.documentElement.removeChild(div)
  })

  it('handles text node among mixed siblings (element + text)', () => {
    const container = document.createElement('div')
    const text1 = document.createTextNode('first')
    const el = document.createElement('span')
    const text2 = document.createTextNode('second')
    container.appendChild(text1)
    container.appendChild(el)
    container.appendChild(text2)
    document.documentElement.appendChild(container)

    // text2 has one text sibling (text1) before it, but el in between is not a text node
    expect(getXPathForElement(text2)).toBe('/div[1]/text()[2]')

    document.documentElement.removeChild(container)
  })
})
