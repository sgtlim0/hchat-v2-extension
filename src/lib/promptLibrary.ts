import { Storage } from './storage'

export interface Prompt {
  id: string
  title: string
  content: string
  shortcut?: string  // e.g. "summary"
  category: string
  usageCount: number
  createdAt: number
}

const KEY = 'hchat:prompts'

export const DEFAULT_PROMPTS: Prompt[] = [
  { id: 'p1', title: '현재 페이지 요약', content: '다음 내용을 핵심 위주로 5줄 이내로 요약해줘:\n\n{{content}}', shortcut: 'sum', category: '읽기', usageCount: 0, createdAt: 0 },
  { id: 'p2', title: '번역 (한국어)', content: '다음을 자연스러운 한국어로 번역해줘:\n\n{{content}}', shortcut: 'tr', category: '번역', usageCount: 0, createdAt: 0 },
  { id: 'p3', title: '문장 다듬기', content: '다음 문장을 더 전문적이고 명확하게 다듬어줘:\n\n{{content}}', shortcut: 'polish', category: '글쓰기', usageCount: 0, createdAt: 0 },
  { id: 'p4', title: '코드 리뷰', content: '다음 코드를 리뷰해줘. 버그, 성능, 가독성 관점에서:\n\n```\n{{content}}\n```', shortcut: 'cr', category: '코드', usageCount: 0, createdAt: 0 },
  { id: 'p5', title: '이메일 작성', content: '다음 내용으로 전문적인 이메일을 작성해줘:\n\n{{content}}', shortcut: 'email', category: '글쓰기', usageCount: 0, createdAt: 0 },
  { id: 'p6', title: '유튜브 요약', content: '다음 유튜브 자막을 핵심 내용 위주로 요약해줘:\n\n{{content}}', shortcut: 'yt', category: '읽기', usageCount: 0, createdAt: 0 },
  { id: 'p7', title: '논거 분석', content: '다음 주장의 찬반 논거를 분석해줘:\n\n{{content}}', shortcut: 'arg', category: '분석', usageCount: 0, createdAt: 0 },
  { id: 'p8', title: '설명 (초등학생)', content: '다음 내용을 초등학생도 이해할 수 있게 설명해줘:\n\n{{content}}', shortcut: 'eli5', category: '설명', usageCount: 0, createdAt: 0 },
]

export const PromptLibrary = {
  async list(): Promise<Prompt[]> {
    const saved = await Storage.get<Prompt[]>(KEY)
    return saved ?? DEFAULT_PROMPTS
  },

  async save(prompt: Omit<Prompt, 'id' | 'createdAt' | 'usageCount'>): Promise<Prompt> {
    const list = await this.list()
    const p: Prompt = { ...prompt, id: crypto.randomUUID(), createdAt: Date.now(), usageCount: 0 }
    list.push(p)
    await Storage.set(KEY, list)
    return p
  },

  async update(id: string, patch: Partial<Prompt>): Promise<void> {
    const list = await this.list()
    const idx = list.findIndex((p) => p.id === id)
    if (idx !== -1) { list[idx] = { ...list[idx], ...patch }; await Storage.set(KEY, list) }
  },

  async delete(id: string): Promise<void> {
    const list = (await this.list()).filter((p) => p.id !== id)
    await Storage.set(KEY, list)
  },

  async incrementUsage(id: string): Promise<void> {
    const list = await this.list()
    const idx = list.findIndex((p) => p.id === id)
    if (idx !== -1) { list[idx].usageCount++; await Storage.set(KEY, list) }
  },

  async searchByShortcut(q: string): Promise<Prompt[]> {
    const list = await this.list()
    const lq = q.toLowerCase()
    return list.filter((p) =>
      p.title.toLowerCase().includes(lq) ||
      p.shortcut?.toLowerCase().startsWith(lq) ||
      p.category.toLowerCase().includes(lq)
    )
  },
}
