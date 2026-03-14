// lib/agentTools.ts — Built-in tools for agent mode

import { webSearch } from './webSearch'
import { getGlobalLocale } from '../i18n'
import { validateExternalUrl } from './urlValidator'
import type { Tool } from './agent'
import { SK } from './storageKeys'

function isEn(): boolean {
  return getGlobalLocale() === 'en'
}

/** Safe math expression evaluator without eval/new Function */
function safeEvalMath(expr: string): number {
  // Reject dangerous characters upfront
  if (/[\\`${}|&;><[\]!~?:=]/.test(expr)) {
    throw new Error('Forbidden characters in expression')
  }

  const MATH_FUNCTIONS = new Set(['sqrt', 'abs', 'ceil', 'floor', 'round', 'pow', 'log', 'sin', 'cos', 'tan', 'min', 'max'])
  const cleaned = expr
    .replace(/Math\.(PI|E)/g, (_, c) => c === 'PI' ? String(Math.PI) : String(Math.E))
    .replace(/Math\.(\w+)/g, (_m, fn) => {
      if (!MATH_FUNCTIONS.has(fn)) throw new Error(`Unknown Math function: ${fn}`)
      return `__${fn}`
    })
    .replace(/\bPI\b/g, String(Math.PI))

  // After replacements, only allow safe characters
  const SAFE_PATTERN = /^[\d\s+\-*/().,%^_a-z]+$/i
  const checkExpr = cleaned.replace(/__\w+/g, '')
  if (!SAFE_PATTERN.test(checkExpr)) {
    throw new Error('Unsafe expression')
  }

  // Tokenize and compute using shunting-yard
  const MATH_FNS: Record<string, (...args: number[]) => number> = {
    sqrt: Math.sqrt, abs: Math.abs, ceil: Math.ceil, floor: Math.floor,
    round: Math.round, log: Math.log, sin: Math.sin, cos: Math.cos,
    tan: Math.tan, min: Math.min, max: Math.max, pow: Math.pow,
  }

  const tokens = cleaned.match(/__\w+|\d+\.?\d*|[+\-*/()^,%,]/g) ?? []
  const output: number[] = []
  const ops: string[] = []
  const argCounts: number[] = [] // track argument counts for multi-arg functions
  const prec: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3 }

  const applyOp = () => {
    const op = ops.pop()!
    if (op.startsWith('__')) {
      const fn = MATH_FNS[op.slice(2)]
      if (!fn) throw new Error(`Unknown function: ${op}`)
      const argc = argCounts.pop() ?? 1
      const args: number[] = []
      for (let i = 0; i < argc; i++) args.unshift(output.pop()!)
      output.push(fn(...args))
    } else {
      const b = output.pop()!, a = output.pop()!
      switch (op) {
        case '+': output.push(a + b); break
        case '-': output.push(a - b); break
        case '*': output.push(a * b); break
        case '/': output.push(a / b); break
        case '%': output.push(a % b); break
        case '^': output.push(Math.pow(a, b)); break
      }
    }
  }

  for (const t of tokens) {
    if (/^\d/.test(t)) {
      output.push(parseFloat(t))
    } else if (t.startsWith('__')) {
      ops.push(t)
      argCounts.push(1)
    } else if (t === '(') {
      ops.push(t)
    } else if (t === ',') {
      while (ops.length && ops[ops.length - 1] !== '(') applyOp()
      if (argCounts.length > 0) argCounts[argCounts.length - 1]++
    } else if (t === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') applyOp()
      ops.pop() // remove '('
      if (ops.length && ops[ops.length - 1]?.startsWith('__')) applyOp()
    } else if (prec[t]) {
      while (ops.length && prec[ops[ops.length - 1]] >= prec[t]) applyOp()
      ops.push(t)
    }
  }
  while (ops.length) applyOp()
  return output[0] ?? NaN
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
        const result = await chrome.storage.local.get(SK.PAGE_CONTEXT)
        const ctx = result[SK.PAGE_CONTEXT]
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
        const urlStr = params.url as string
        const validation = validateExternalUrl(urlStr)
        if (!validation.valid) {
          return `${isEn() ? 'Blocked URL' : '차단된 URL'}: ${validation.reason}`
        }
        const res = await fetch(urlStr, {
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
        const expr = String(params.expression)
        const result = safeEvalMath(expr)
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
  {
    name: 'translate',
    get description() { return isEn() ? 'Translate text into a specified language. Returns a prompt for the AI to perform translation.' : '텍스트를 지정된 언어로 번역합니다. AI가 번역을 수행할 프롬프트를 반환합니다.' },
    parameters: {
      text: { type: 'string', get description() { return isEn() ? 'Text to translate' : '번역할 텍스트' }, required: true },
      targetLang: { type: 'string', get description() { return isEn() ? 'Target language (e.g. English, Korean, Japanese)' : '대상 언어 (예: 영어, 한국어, 일본어)' }, required: true },
    },
    execute: async (params) => {
      const text = String(params.text ?? '')
      const lang = String(params.targetLang ?? 'English')
      if (!text) return isEn() ? 'Error: No text provided' : '오류: 텍스트가 없습니다'
      return isEn()
        ? `Please translate the following text into ${lang}:\n\n${text}`
        : `다음 텍스트를 ${lang}로 번역해주세요:\n\n${text}`
    },
  },
  {
    name: 'summarize_text',
    get description() { return isEn() ? 'Summarize given text. Returns a prompt for the AI to perform summarization.' : '주어진 텍스트를 요약합니다. AI가 요약을 수행할 프롬프트를 반환합니다.' },
    parameters: {
      text: { type: 'string', get description() { return isEn() ? 'Text to summarize' : '요약할 텍스트' }, required: true },
      maxLength: { type: 'string', get description() { return isEn() ? 'Maximum length hint (e.g. "3 sentences", "100 words")' : '최대 길이 힌트 (예: "3문장", "100단어")' } },
    },
    execute: async (params) => {
      const text = String(params.text ?? '')
      const maxLength = params.maxLength ? String(params.maxLength) : undefined
      if (!text) return isEn() ? 'Error: No text provided' : '오류: 텍스트가 없습니다'
      const lengthHint = maxLength
        ? (isEn() ? ` Keep it within ${maxLength}.` : ` ${maxLength} 이내로 작성해주세요.`)
        : ''
      return isEn()
        ? `Please summarize the following text concisely.${lengthHint}\n\n${text}`
        : `다음 텍스트를 간결하게 요약해주세요.${lengthHint}\n\n${text}`
    },
  },
  {
    name: 'timestamp_convert',
    get description() { return isEn() ? 'Convert between Unix timestamp and human-readable date. Auto-detects input format.' : 'Unix 타임스탬프와 사람이 읽을 수 있는 날짜 간 변환합니다. 입력 형식을 자동 감지합니다.' },
    parameters: {
      value: { type: 'string', get description() { return isEn() ? 'Unix timestamp (number) or date string' : 'Unix 타임스탬프(숫자) 또는 날짜 문자열' }, required: true },
    },
    execute: async (params) => {
      const value = String(params.value ?? '').trim()
      if (!value) return isEn() ? 'Error: No value provided' : '오류: 값이 없습니다'

      // Detect if it's a numeric timestamp
      if (/^\d{10,13}$/.test(value)) {
        const ms = value.length <= 10 ? Number(value) * 1000 : Number(value)
        const date = new Date(ms)
        if (isNaN(date.getTime())) return isEn() ? 'Error: Invalid timestamp' : '오류: 유효하지 않은 타임스탬프'
        return [
          `Unix: ${value}`,
          `UTC: ${date.toUTCString()}`,
          `Local: ${date.toLocaleString('ko-KR', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })}`,
          `ISO: ${date.toISOString()}`,
        ].join('\n')
      }

      // Try parsing as date string
      const date = new Date(value)
      if (isNaN(date.getTime())) {
        return isEn() ? `Error: Cannot parse "${value}" as a date` : `오류: "${value}"를 날짜로 파싱할 수 없습니다`
      }
      return [
        `Input: ${value}`,
        `Unix (seconds): ${Math.floor(date.getTime() / 1000)}`,
        `Unix (ms): ${date.getTime()}`,
        `ISO: ${date.toISOString()}`,
        `UTC: ${date.toUTCString()}`,
      ].join('\n')
    },
  },
]
