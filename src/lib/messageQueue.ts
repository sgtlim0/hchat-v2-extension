import { Storage } from './storage'
import { SK } from './storageKeys'

const QUEUE_KEY = SK.MESSAGE_QUEUE

export interface QueuedMessage {
  readonly id: string
  readonly convId: string
  readonly text: string
  readonly model: string
  readonly opts?: Record<string, unknown>
  readonly queuedAt: number
}

type SendFn = (msg: QueuedMessage) => Promise<void>

async function readQueue(): Promise<readonly QueuedMessage[]> {
  const data = await Storage.get<QueuedMessage[]>(QUEUE_KEY)
  return data ?? []
}

async function writeQueue(queue: readonly QueuedMessage[]): Promise<void> {
  await Storage.set(QUEUE_KEY, [...queue])
}

export const MessageQueue = {
  async enqueue(msg: Omit<QueuedMessage, 'id' | 'queuedAt'>): Promise<QueuedMessage> {
    const queued: QueuedMessage = {
      ...msg,
      id: crypto.randomUUID(),
      queuedAt: Date.now(),
    }
    const current = await readQueue()
    await writeQueue([...current, queued])
    return queued
  },

  async dequeue(): Promise<QueuedMessage | null> {
    const current = await readQueue()
    if (current.length === 0) return null
    const [first, ...rest] = current
    await writeQueue(rest)
    return first
  },

  async getAll(): Promise<readonly QueuedMessage[]> {
    return readQueue()
  },

  async clear(): Promise<void> {
    await Storage.remove(QUEUE_KEY)
  },

  async processQueue(sendFn: SendFn): Promise<{ sent: number; failed: number }> {
    const current = await readQueue()
    if (current.length === 0) return { sent: 0, failed: 0 }

    let sent = 0
    let failed = 0
    const remaining: QueuedMessage[] = []

    for (const msg of current) {
      try {
        await sendFn(msg)
        sent++
      } catch {
        failed++
        remaining.push(msg)
      }
    }

    await writeQueue(remaining)
    return { sent, failed }
  },
}
