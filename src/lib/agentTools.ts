// lib/agentTools.ts — Built-in tools for agent mode

import { webSearch } from './webSearch'
import { getGlobalLocale } from '../i18n'
import type { Tool } from './agent'

function isEn(): boolean {
  return getGlobalLocale() === 'en'
}

export const BUILTIN_TOOLS: Tool[] = [
  {
    name: 'web_search',
    get description() { return isEn() ? 'Search the web for latest information. Useful for real-time info, news, prices, weather, etc.' : '웹에서 최신 정보를 검색합니다. 실시간 정보, 뉴스, 가격, 날씨 등에 유용합니다.' },
    parameters: {
      query: { type: 'string', get description() { return isEn() ? 'Search query' : '검색 쿼리' }, required: true },
    },
    execute: async (params) => {
      const results = await webSearch({ query: params.query as string, maxResults: 5 })
      if (results.length === 0) return isEn() ? 'No search results found.' : '검색 결과가 없습니다.'
      return results
        .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet}`)
        .join('\n\n')
    },
  },
  {
    name: 'read_page',
    get description() { return isEn() ? 'Read the content of the web page the user is currently viewing.' : '현재 사용자가 보고 있는 웹페이지의 내용을 읽습니다.' },
    parameters: {},
    execute: async () => {
      try {
        const result = await chrome.storage.local.get('hchat:page-context')
        const ctx = result['hchat:page-context']
        if (!ctx) return isEn() ? 'Cannot read current page context.' : '현재 페이지 컨텍스트를 읽을 수 없습니다.'
        return `Title: ${ctx.title}\nURL: ${ctx.url}\nType: ${ctx.meta?.type ?? 'unknown'}\n\n${ctx.text}`
      } catch {
        return isEn() ? 'Cannot read page content.' : '페이지 내용을 읽을 수 없습니다.'
      }
    },
  },
  {
    name: 'fetch_url',
    get description() { return isEn() ? 'Fetch the content of a specified URL. Use to check detailed content of links.' : '지정된 URL의 웹페이지 내용을 가져옵니다. 링크의 상세 내용을 확인할 때 사용합니다.' },
    parameters: {
      url: { type: 'string', get description() { return isEn() ? 'URL of the web page to fetch' : '가져올 웹페이지 URL' }, required: true },
    },
    execute: async (params) => {
      try {
        const res = await fetch(params.url as string, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HChatBot/2.0)' },
        })
        if (!res.ok) return `HTTP ${isEn() ? 'error' : '오류'}: ${res.status}`
        const html = await res.text()
        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')
        // Remove noise
        doc.querySelectorAll('script,style,nav,header,footer,aside').forEach((e) => e.remove())
        const main = doc.querySelector('main, article, [role="main"]') ?? doc.body
        const text = (main?.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim()
        return text.slice(0, 6000)
      } catch (err) {
        return `${isEn() ? 'Failed to fetch URL' : 'URL 가져오기 실패'}: ${String(err)}`
      }
    },
  },
  {
    name: 'calculate',
    get description() { return isEn() ? 'Perform math calculations or simple data transformations. Evaluates JavaScript expressions.' : '수학 계산이나 간단한 데이터 변환을 수행합니다. JavaScript 표현식을 평가합니다.' },
    parameters: {
      expression: { type: 'string', get description() { return isEn() ? 'Math/JavaScript expression to evaluate' : '평가할 수학/JavaScript 표현식' }, required: true },
    },
    execute: async (params) => {
      try {
        // Only allow safe math expressions
        const expr = String(params.expression)
        const safePattern = /^[\d\s+\-*/().,%^Math.PIEeNaN_a-zA-Z]+$/
        if (!safePattern.test(expr)) {
          return isEn() ? 'Unsafe expression. Only math calculations are allowed.' : '안전하지 않은 표현식입니다. 수학 계산만 가능합니다.'
        }
        const fn = new Function(`"use strict"; return (${expr})`)
        const result = fn()
        return String(result)
      } catch (err) {
        return `${isEn() ? 'Calculation error' : '계산 오류'}: ${String(err)}`
      }
    },
  },
  {
    name: 'get_datetime',
    description: '현재 날짜와 시간 정보를 가져옵니다.',
    parameters: {},
    execute: async () => {
      const now = new Date()
      const days = ['일', '월', '화', '수', '목', '금', '토']
      return [
        `날짜: ${now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}`,
        `요일: ${days[now.getDay()]}요일`,
        `시간: ${now.toLocaleTimeString('ko-KR')}`,
        `타임존: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
        `Unix: ${now.getTime()}`,
      ].join('\n')
    },
  },
]
