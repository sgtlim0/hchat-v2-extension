// lib/teamSharing.ts — 팀 공유 패키지 (비서, 프롬프트, 템플릿, 체인, 워크플로우)

import { Storage } from './storage'

const HISTORY_KEY = 'hchat:share-history'
const SHARED_ITEMS_KEY = 'hchat:shared-items'
const MAX_HISTORY = 50
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

export type ShareItemType = 'assistant' | 'prompt' | 'template' | 'chain' | 'workflow'

const VALID_TYPES: ReadonlySet<string> = new Set<ShareItemType>([
  'assistant',
  'prompt',
  'template',
  'chain',
  'workflow',
])

export interface ShareItem {
  type: ShareItemType
  data: unknown
}

export interface SharePackage {
  formatVersion: number
  author: string
  description: string
  createdAt: number
  items: ShareItem[]
}

export interface ImportResult {
  added: number
  skipped: number
  updated: number
  errors: string[]
}

export interface ShareRecord {
  id: string
  type: 'export' | 'import'
  packageName: string
  itemCount: number
  timestamp: number
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

interface ApplyOptions {
  overwrite?: boolean
}

interface StoredItem {
  type: ShareItemType
  data: Record<string, unknown>
}

// --- 공유 패키지 생성 ---

export function createSharePackage(
  items: ShareItem[],
  meta: { author: string; description: string },
): SharePackage {
  return {
    formatVersion: 1,
    author: meta.author,
    description: meta.description,
    createdAt: Date.now(),
    items: [...items],
  }
}

// --- 직렬화 / 역직렬화 ---

export function exportPackage(pkg: SharePackage): string {
  return JSON.stringify(pkg, null, 2)
}

export function importPackage(json: string): SharePackage {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('잘못된 JSON 형식입니다')
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('패키지 형식이 올바르지 않습니다')
  }

  const obj = parsed as Record<string, unknown>

  if (!('formatVersion' in obj)) {
    throw new Error('formatVersion이 필요합니다')
  }

  if (obj.formatVersion !== 1) {
    throw new Error(`지원하지 않는 formatVersion: ${obj.formatVersion}`)
  }

  return obj as unknown as SharePackage
}

// --- 패키지 검증 ---

export function validatePackage(pkg: SharePackage): ValidationResult {
  const errors: string[] = []

  if (pkg.formatVersion !== 1) {
    errors.push('formatVersion은 1이어야 합니다')
  }

  if (!pkg.author || !pkg.author.trim()) {
    errors.push('author가 필요합니다')
  }

  for (let i = 0; i < pkg.items.length; i++) {
    const item = pkg.items[i]
    if (!VALID_TYPES.has(item.type)) {
      errors.push(`항목 ${i}: 잘못된 type "${item.type}"`)
    }
  }

  const serialized = JSON.stringify(pkg)
  if (new Blob([serialized]).size > MAX_SIZE_BYTES) {
    errors.push('패키지 크기가 5MB를 초과합니다')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

// --- 항목 가져오기 ---

function getItemId(item: ShareItem): string | null {
  if (typeof item.data === 'object' && item.data !== null && 'id' in item.data) {
    return String((item.data as Record<string, unknown>).id)
  }
  return null
}

async function getStoredItems(): Promise<StoredItem[]> {
  return (await Storage.get<StoredItem[]>(SHARED_ITEMS_KEY)) ?? []
}

async function saveStoredItems(items: StoredItem[]): Promise<void> {
  await Storage.set(SHARED_ITEMS_KEY, items)
}

export async function applyPackage(
  pkg: SharePackage,
  options?: ApplyOptions,
): Promise<ImportResult> {
  const overwrite = options?.overwrite ?? false
  const stored = await getStoredItems()
  const existingIds = new Map<string, number>()

  for (let i = 0; i < stored.length; i++) {
    const id = stored[i].data?.id
    if (id != null) {
      existingIds.set(String(id), i)
    }
  }

  let added = 0
  let skipped = 0
  let updated = 0
  const errors: string[] = []
  const newStored = [...stored]

  for (const item of pkg.items) {
    const id = getItemId(item)

    if (id !== null && existingIds.has(id)) {
      if (overwrite) {
        const idx = existingIds.get(id)!
        newStored[idx] = { type: item.type, data: item.data as Record<string, unknown> }
        updated++
      } else {
        skipped++
      }
    } else {
      newStored.push({ type: item.type, data: item.data as Record<string, unknown> })
      added++
    }
  }

  await saveStoredItems(newStored)

  return { added, skipped, updated, errors }
}

// --- 공유 히스토리 ---

export async function getShareHistory(): Promise<ShareRecord[]> {
  return (await Storage.get<ShareRecord[]>(HISTORY_KEY)) ?? []
}

export async function addShareRecord(record: ShareRecord): Promise<void> {
  const history = await getShareHistory()
  const updated = [...history, record]

  // FIFO: 최대 50개 유지
  const trimmed = updated.length > MAX_HISTORY
    ? updated.slice(updated.length - MAX_HISTORY)
    : updated

  await Storage.set(HISTORY_KEY, trimmed)
}
