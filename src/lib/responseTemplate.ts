import { Storage } from './storage'

const STORAGE_KEY = 'hchat:response-styles'
const MAX_CUSTOM_STYLES = 20
const SHORT_LENGTH_THRESHOLD = 200
const MEDIUM_LENGTH_THRESHOLD = 500

export interface ResponseStyle {
  id: string
  name: string
  tone: 'formal' | 'casual' | 'technical' | 'friendly'
  lengthGuide: 'short' | 'medium' | 'long'
  formatHints: string[]
  systemPromptSuffix: string
  usageCount: number
  createdAt: number
  builtin?: boolean
}

type CreateStyleInput = Omit<ResponseStyle, 'id' | 'createdAt' | 'usageCount' | 'builtin'>

export const BUILTIN_STYLES: ResponseStyle[] = [
  {
    id: 'concise',
    name: '간결',
    tone: 'formal',
    lengthGuide: 'short',
    formatHints: ['use short sentences', 'omit filler words'],
    systemPromptSuffix: '답변을 간결하고 핵심만 전달하세요. 200자 이내로 작성하세요.',
    usageCount: 0,
    createdAt: 0,
    builtin: true,
  },
  {
    id: 'detailed',
    name: '상세',
    tone: 'formal',
    lengthGuide: 'long',
    formatHints: ['include examples', 'explain step by step', 'use headers'],
    systemPromptSuffix: '답변을 상세하고 체계적으로 작성하세요. 예시와 단계별 설명을 포함하세요.',
    usageCount: 0,
    createdAt: 0,
    builtin: true,
  },
  {
    id: 'technical',
    name: '기술적',
    tone: 'technical',
    lengthGuide: 'medium',
    formatHints: ['include code examples', 'use precise terminology', 'reference documentation'],
    systemPromptSuffix: '기술적으로 정확하게 답변하세요. 코드 예시와 정확한 용어를 사용하세요.',
    usageCount: 0,
    createdAt: 0,
    builtin: true,
  },
  {
    id: 'casual',
    name: '캐주얼',
    tone: 'casual',
    lengthGuide: 'medium',
    formatHints: ['use conversational tone', 'keep it friendly'],
    systemPromptSuffix: '편안하고 친근한 톤으로 답변하세요. 대화하듯 자연스럽게 작성하세요.',
    usageCount: 0,
    createdAt: 0,
    builtin: true,
  },
]

async function loadCustomStyles(): Promise<ResponseStyle[]> {
  try {
    const stored = await Storage.get<ResponseStyle[]>(STORAGE_KEY)
    return Array.isArray(stored) ? stored : []
  } catch {
    return []
  }
}

async function saveCustomStyles(styles: ResponseStyle[]): Promise<void> {
  await Storage.set(STORAGE_KEY, styles)
}

export async function getStyles(): Promise<ResponseStyle[]> {
  const custom = await loadCustomStyles()
  return [...BUILTIN_STYLES, ...custom]
}

export async function saveStyle(input: CreateStyleInput): Promise<ResponseStyle> {
  if (!input.name.trim()) {
    throw new Error('스타일 이름은 비어있을 수 없습니다')
  }

  const custom = await loadCustomStyles()

  const allStyles = [...BUILTIN_STYLES, ...custom]
  const duplicate = allStyles.some(
    (s) => s.name.toLowerCase() === input.name.toLowerCase(),
  )
  if (duplicate) {
    throw new Error(`이미 존재하는 스타일 이름입니다: ${input.name}`)
  }

  if (custom.length >= MAX_CUSTOM_STYLES) {
    throw new Error(`최대 ${MAX_CUSTOM_STYLES}개의 커스텀 스타일만 저장할 수 있습니다`)
  }

  const newStyle: ResponseStyle = {
    ...input,
    id: crypto.randomUUID(),
    usageCount: 0,
    createdAt: Date.now(),
  }

  await saveCustomStyles([...custom, newStyle])
  return newStyle
}

export async function updateStyle(
  id: string,
  patch: Partial<Omit<ResponseStyle, 'id' | 'createdAt' | 'builtin'>>,
): Promise<ResponseStyle> {
  const custom = await loadCustomStyles()
  const index = custom.findIndex((s) => s.id === id)

  if (index === -1) {
    throw new Error(`스타일을 찾을 수 없습니다: ${id}`)
  }

  const updated: ResponseStyle = { ...custom[index], ...patch, id, createdAt: custom[index].createdAt }
  const newCustom = custom.map((s, i) => (i === index ? updated : s))
  await saveCustomStyles(newCustom)
  return updated
}

export async function deleteStyle(id: string): Promise<void> {
  const isBuiltin = BUILTIN_STYLES.some((s) => s.id === id)
  if (isBuiltin) {
    throw new Error('내장 스타일은 삭제할 수 없습니다')
  }

  const custom = await loadCustomStyles()
  const index = custom.findIndex((s) => s.id === id)

  if (index === -1) {
    throw new Error(`스타일을 찾을 수 없습니다: ${id}`)
  }

  await saveCustomStyles(custom.filter((s) => s.id !== id))
}

function cleanExcessiveBlankLines(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n')
}

function inferLanguageTag(codeContent: string): string {
  const trimmed = codeContent.trim()
  if (/\b(const|let|var|function|=>|import\s|export\s)\b/.test(trimmed)) {
    return 'javascript'
  }
  if (/\b(def |class |import |from |print\()/.test(trimmed)) {
    return 'python'
  }
  if (/\b(func |package |go |fmt\.)/.test(trimmed)) {
    return 'go'
  }
  if (/<[a-z][^>]*>/i.test(trimmed) && /<\/[a-z]+>/i.test(trimmed)) {
    return 'html'
  }
  return ''
}

function fixBareCodeBlocks(text: string): string {
  return text.replace(/```\n([\s\S]*?)```/g, (_match, code: string) => {
    const lang = inferLanguageTag(code)
    return lang ? `\`\`\`${lang}\n${code}\`\`\`` : `\`\`\`\n${code}\`\`\``
  })
}

function getLengthThreshold(guide: ResponseStyle['lengthGuide']): number {
  if (guide === 'short') return SHORT_LENGTH_THRESHOLD
  if (guide === 'medium') return MEDIUM_LENGTH_THRESHOLD
  return Infinity
}

function appendLengthWarning(text: string, style: ResponseStyle): string {
  const threshold = getLengthThreshold(style.lengthGuide)
  if (text.length > threshold && threshold < Infinity) {
    return `${text}\n\n---\n_응답이 ${style.lengthGuide === 'short' ? '간결' : '중간'} 길이 가이드(${threshold}자)를 초과했습니다._`
  }
  return text
}

export function applyStyle(response: string, style: ResponseStyle): string {
  if (!response) return ''

  let result = response
  result = cleanExcessiveBlankLines(result)
  result = fixBareCodeBlocks(result)
  result = appendLengthWarning(result, style)

  return result
}

export async function trackStyleUsage(styleId: string): Promise<void> {
  const custom = await loadCustomStyles()
  const index = custom.findIndex((s) => s.id === styleId)

  if (index === -1) return

  const updated = custom.map((s, i) =>
    i === index ? { ...s, usageCount: s.usageCount + 1 } : s,
  )
  await saveCustomStyles(updated)
}

export async function getRecommendedStyle(): Promise<ResponseStyle | null> {
  const all = await getStyles()
  const withUsage = all.filter((s) => s.usageCount > 0)

  if (withUsage.length === 0) return null

  return withUsage.reduce((best, current) =>
    current.usageCount > best.usageCount ? current : best,
  )
}
