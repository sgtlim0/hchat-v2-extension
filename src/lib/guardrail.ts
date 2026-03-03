import { Storage } from './storage'

export type PIIType = 'email' | 'phone' | 'ssn' | 'card' | 'bank'

export interface PIIDetection {
  type: PIIType
  value: string
  masked: string
  start: number
  end: number
}

export interface GuardrailConfig {
  enabled: boolean
  types: Record<PIIType, boolean>
  action: 'warn' | 'mask' | 'block'
}

const DEFAULT_CONFIG: GuardrailConfig = {
  enabled: true,
  types: { email: true, phone: true, ssn: true, card: true, bank: true },
  action: 'warn',
}

const PII_PATTERNS: Record<PIIType, RegExp> = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /(?:010|011|016|017|018|019)[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g,
  ssn: /\b\d{6}[-.\s]?\d{7}\b/g,
  card: /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g,
  bank: /\b\d{3,4}[-.\s]?\d{4,6}[-.\s]?\d{4,6}(?:[-.\s]?\d{1,4})?\b/g,
}

function maskEmail(value: string): string {
  const [local, domain] = value.split('@')
  if (!local || !domain) return value
  const maskedLocal = local[0] + '***'
  const [domainName, ...rest] = domain.split('.')
  const maskedDomain = domainName[0] + '***'
  return `${maskedLocal}@${maskedDomain}.${rest.join('.')}`
}

function maskPhone(value: string): string {
  const parts = value.split(/[-.\s]/)
  if (parts.length >= 3) {
    const sep = value.match(/[-.\s]/)?.[0] ?? '-'
    return `${parts[0]}${sep}****${sep}${parts[parts.length - 1]}`
  }

  const cleaned = value.replace(/[-.\s]/g, '')
  if (cleaned.length < 4) return '****'
  const last4 = cleaned.slice(-4)
  const prefix = cleaned.slice(0, 3)
  return `${prefix}-****-${last4}`
}

function maskSSN(value: string): string {
  if (value.includes('-')) {
    return '******-*******'
  }
  return '*************'
}

function maskCard(value: string): string {
  const parts = value.split(/[-.\s]/)
  if (parts.length === 4) {
    const sep = value.match(/[-.\s]/)?.[0] ?? '-'
    return `****${sep}****${sep}****${sep}${parts[3]}`
  }

  const cleaned = value.replace(/[-.\s]/g, '')
  if (cleaned.length < 4) return '****'
  const last4 = cleaned.slice(-4)
  return `****-****-****-${last4}`
}

function maskBank(_value: string): string {
  return '***-******-****'
}

function getMaskedValue(type: PIIType, value: string): string {
  switch (type) {
    case 'email':
      return maskEmail(value)
    case 'phone':
      return maskPhone(value)
    case 'ssn':
      return maskSSN(value)
    case 'card':
      return maskCard(value)
    case 'bank':
      return maskBank(value)
    default:
      return value
  }
}

function isValidBankAccount(value: string): boolean {
  const cleaned = value.replace(/[-.\s]/g, '')
  return cleaned.length >= 10
}

function isValidCardNumber(value: string): boolean {
  const cleaned = value.replace(/[-.\s]/g, '')
  return cleaned.length === 16
}

export function detectPII(text: string, config?: Partial<GuardrailConfig>): PIIDetection[] {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  if (!cfg.enabled) {
    return []
  }

  const detections: PIIDetection[] = []
  const processedRanges: Array<{ start: number; end: number }> = []

  const isOverlapping = (start: number, end: number): boolean => {
    return processedRanges.some((range) => !(end <= range.start || start >= range.end))
  }

  const orderedTypes: PIIType[] = ['email', 'card', 'ssn', 'phone', 'bank']

  for (const type of orderedTypes) {
    if (!cfg.types[type]) continue

    const pattern = PII_PATTERNS[type]
    pattern.lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = pattern.exec(text)) !== null) {
      const value = match[0]
      const start = match.index
      const end = start + value.length

      if (isOverlapping(start, end)) continue

      if (type === 'bank' && !isValidBankAccount(value)) continue
      if (type === 'card' && !isValidCardNumber(value)) continue

      detections.push({
        type,
        value,
        masked: getMaskedValue(type, value),
        start,
        end,
      })

      processedRanges.push({ start, end })
    }
  }

  return detections.sort((a, b) => a.start - b.start)
}

export function maskPII(text: string, detections: PIIDetection[]): string {
  let result = text
  const sorted = [...detections].sort((a, b) => b.start - a.start)

  for (const detection of sorted) {
    result = result.slice(0, detection.start) + detection.masked + result.slice(detection.end)
  }

  return result
}

export function getPIILabel(type: PIIType): string {
  const labels: Record<PIIType, string> = {
    email: 'Email',
    phone: 'Phone',
    ssn: 'SSN',
    card: 'Card',
    bank: 'Bank',
  }
  return labels[type]
}

const CONFIG_KEY = 'hchat:guardrail-config'

export async function getGuardrailConfig(): Promise<GuardrailConfig> {
  const stored = await Storage.get<GuardrailConfig>(CONFIG_KEY)
  return stored ? { ...DEFAULT_CONFIG, ...stored } : DEFAULT_CONFIG
}

export async function setGuardrailConfig(config: Partial<GuardrailConfig>): Promise<void> {
  const current = await getGuardrailConfig()
  await Storage.set(CONFIG_KEY, { ...current, ...config })
}
