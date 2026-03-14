import { Storage } from './storage'
import { SK } from './storageKeys'

const STORAGE_KEY = SK.USER_PREFS
const MAX_ENTRIES_PER_CATEGORY = 50
const DEFAULT_LIMIT = 5
const RECENT_DAYS = 7
const DECAY_DAYS = 30
const DECAY_WEIGHT = 0.3
const MS_PER_DAY = 86_400_000

export interface UsageEntry {
  id: string
  count: number
  lastUsed: number
}

export interface UserPreferences {
  assistantFreq: UsageEntry[]
  modelFreq: UsageEntry[]
  toolFreq: UsageEntry[]
  updatedAt: number
}

type Category = 'assistant' | 'model' | 'tool'

function createDefaultPreferences(): UserPreferences {
  return {
    assistantFreq: [],
    modelFreq: [],
    toolFreq: [],
    updatedAt: Date.now(),
  }
}

function getCategoryKey(category: Category): keyof UserPreferences {
  const map: Record<Category, keyof UserPreferences> = {
    assistant: 'assistantFreq',
    model: 'modelFreq',
    tool: 'toolFreq',
  }
  return map[category]
}

function getAgeDays(timestamp: number, now: number): number {
  return (now - timestamp) / MS_PER_DAY
}

function applyDecay(entries: UsageEntry[], now: number): UsageEntry[] {
  return entries
    .filter((entry) => getAgeDays(entry.lastUsed, now) <= DECAY_DAYS)
    .map((entry) => {
      const ageDays = getAgeDays(entry.lastUsed, now)
      const weight = ageDays <= RECENT_DAYS ? 1.0 : DECAY_WEIGHT
      return {
        ...entry,
        count: entry.count * weight,
      }
    })
}

function sortByCountThenRecency(a: UsageEntry, b: UsageEntry): number {
  if (b.count !== a.count) return b.count - a.count
  return b.lastUsed - a.lastUsed
}

function pruneToLimit(entries: UsageEntry[]): UsageEntry[] {
  if (entries.length <= MAX_ENTRIES_PER_CATEGORY) return entries
  return [...entries]
    .sort(sortByCountThenRecency)
    .slice(0, MAX_ENTRIES_PER_CATEGORY)
}

async function loadPreferences(): Promise<UserPreferences> {
  try {
    const stored = await Storage.get<UserPreferences>(STORAGE_KEY)
    if (
      stored &&
      Array.isArray(stored.assistantFreq) &&
      Array.isArray(stored.modelFreq) &&
      Array.isArray(stored.toolFreq)
    ) {
      return stored
    }
  } catch {
    // corrupted data — return defaults
  }
  return createDefaultPreferences()
}

async function savePreferences(prefs: UserPreferences): Promise<void> {
  await Storage.set(STORAGE_KEY, prefs)
}

export async function trackUsage(category: Category, id: string): Promise<void> {
  const prefs = await loadPreferences()
  const key = getCategoryKey(category)
  const entries = prefs[key] as UsageEntry[]
  const now = Date.now()

  const existing = entries.find((e) => e.id === id)
  const updatedEntries = existing
    ? entries.map((e) =>
        e.id === id ? { ...e, count: e.count + 1, lastUsed: now } : e,
      )
    : [...entries, { id, count: 1, lastUsed: now }]

  const pruned = pruneToLimit(updatedEntries)

  await savePreferences({
    ...prefs,
    [key]: pruned,
    updatedAt: now,
  })
}

export async function getTopUsed(
  category: Category,
  limit: number = DEFAULT_LIMIT,
): Promise<UsageEntry[]> {
  const prefs = await loadPreferences()
  const key = getCategoryKey(category)
  const entries = prefs[key] as UsageEntry[]
  const now = Date.now()

  const weighted = applyDecay(entries, now)
  return [...weighted].sort(sortByCountThenRecency).slice(0, limit)
}

export async function getPreferences(): Promise<UserPreferences> {
  return loadPreferences()
}

export async function resetPreferences(): Promise<void> {
  await savePreferences(createDefaultPreferences())
}

export async function isRecommended(
  category: Category,
  id: string,
): Promise<boolean> {
  const top = await getTopUsed(category, 3)
  return top.some((entry) => entry.id === id)
}
