import { describe, it, expect, beforeEach } from 'vitest'
import { detectPII, maskPII, getPIILabel, getGuardrailConfig, setGuardrailConfig } from '../guardrail'

beforeEach(async () => {
  await chrome.storage.local.clear()
})

describe('detectPII', () => {
  it('finds email addresses', () => {
    const text = 'Contact me at john.doe@example.com for more info'
    const detections = detectPII(text)

    expect(detections).toHaveLength(1)
    expect(detections[0].type).toBe('email')
    expect(detections[0].value).toBe('john.doe@example.com')
  })

  it('finds Korean phone numbers with hyphens', () => {
    const text = '전화번호는 010-1234-5678입니다'
    const detections = detectPII(text)

    expect(detections).toHaveLength(1)
    expect(detections[0].type).toBe('phone')
    expect(detections[0].value).toBe('010-1234-5678')
  })

  it('finds phone with dots', () => {
    const text = '연락처: 010.9876.5432'
    const detections = detectPII(text)

    expect(detections).toHaveLength(1)
    expect(detections[0].type).toBe('phone')
    expect(detections[0].value).toBe('010.9876.5432')
  })

  it('finds phone without separators', () => {
    const text = '휴대폰 01012345678'
    const detections = detectPII(text)

    expect(detections).toHaveLength(1)
    expect(detections[0].type).toBe('phone')
    expect(detections[0].value).toBe('01012345678')
  })

  it('finds SSN', () => {
    const text = '주민번호 900101-1234567'
    const detections = detectPII(text)

    expect(detections).toHaveLength(1)
    expect(detections[0].type).toBe('ssn')
    expect(detections[0].value).toBe('900101-1234567')
  })

  it('finds credit card', () => {
    const text = 'Card: 1234-5678-9012-3456'
    const detections = detectPII(text)

    expect(detections).toHaveLength(1)
    expect(detections[0].type).toBe('card')
    expect(detections[0].value).toBe('1234-5678-9012-3456')
  })

  it('finds bank account', () => {
    const text = '계좌: 123-456789-01234'
    const detections = detectPII(text)

    expect(detections).toHaveLength(1)
    expect(detections[0].type).toBe('bank')
    expect(detections[0].value).toBe('123-456789-01234')
  })

  it('finds multiple PII types in one text', () => {
    const text = 'Email: test@example.com, Phone: 010-1111-2222, SSN: 850101-1111111'
    const detections = detectPII(text)

    expect(detections).toHaveLength(3)
    expect(detections[0].type).toBe('email')
    expect(detections[1].type).toBe('phone')
    expect(detections[2].type).toBe('ssn')
  })

  it('returns empty array for clean text', () => {
    const text = 'This is a normal message without any personal information.'
    const detections = detectPII(text)

    expect(detections).toEqual([])
  })

  it('returns empty array for empty string', () => {
    const detections = detectPII('')

    expect(detections).toEqual([])
  })

  it('respects disabled types', () => {
    const text = 'Email: test@example.com, Phone: 010-1234-5678'
    const detections = detectPII(text, { types: { email: false, phone: true, ssn: true, card: true, bank: true } })

    expect(detections).toHaveLength(1)
    expect(detections[0].type).toBe('phone')
  })

  it('respects enabled: false', () => {
    const text = 'Email: test@example.com, Phone: 010-1234-5678'
    const detections = detectPII(text, { enabled: false })

    expect(detections).toEqual([])
  })

  it('filters out invalid bank accounts (too short)', () => {
    const text = 'Short: 123-45-67'
    const detections = detectPII(text)

    expect(detections).toEqual([])
  })

  it('filters out invalid card numbers (not 16 digits)', () => {
    const text = 'Card: 1234-5678'
    const detections = detectPII(text)

    expect(detections).toEqual([])
  })
})

describe('maskPII', () => {
  it('masks email correctly', () => {
    const text = 'Contact john.doe@example.com please'
    const detections = detectPII(text)
    const masked = maskPII(text, detections)

    expect(masked).toBe('Contact j***@e***.com please')
  })

  it('masks phone correctly', () => {
    const text = '전화: 010-1234-5678'
    const detections = detectPII(text)
    const masked = maskPII(text, detections)

    expect(masked).toBe('전화: 010-****-5678')
  })

  it('masks SSN completely', () => {
    const text = 'SSN: 900101-1234567'
    const detections = detectPII(text)
    const masked = maskPII(text, detections)

    expect(masked).toBe('SSN: ******-*******')
  })

  it('masks card keeping last 4', () => {
    const text = 'Card: 1234-5678-9012-3456'
    const detections = detectPII(text)
    const masked = maskPII(text, detections)

    expect(masked).toBe('Card: ****-****-****-3456')
  })

  it('masks bank completely', () => {
    const text = '계좌: 123-456789-01234'
    const detections = detectPII(text)
    const masked = maskPII(text, detections)

    expect(masked).toBe('계좌: ***-******-****')
  })

  it('handles multiple detections', () => {
    const text = 'test@example.com and 010-1234-5678'
    const detections = detectPII(text)
    const masked = maskPII(text, detections)

    expect(masked).toContain('t***@e***.com')
    expect(masked).toContain('010-****-5678')
  })

  it('preserves surrounding text', () => {
    const text = 'Before test@example.com After'
    const detections = detectPII(text)
    const masked = maskPII(text, detections)

    expect(masked).toBe('Before t***@e***.com After')
  })

  it('returns original text for empty detections', () => {
    const text = 'No PII here'
    const masked = maskPII(text, [])

    expect(masked).toBe('No PII here')
  })
})

describe('getPIILabel', () => {
  it('returns correct labels', () => {
    expect(getPIILabel('email')).toBe('Email')
    expect(getPIILabel('phone')).toBe('Phone')
    expect(getPIILabel('ssn')).toBe('SSN')
    expect(getPIILabel('card')).toBe('Card')
    expect(getPIILabel('bank')).toBe('Bank')
  })
})

describe('getGuardrailConfig', () => {
  it('returns default config when nothing stored', async () => {
    const config = await getGuardrailConfig()

    expect(config.enabled).toBe(true)
    expect(config.types.email).toBe(true)
    expect(config.types.phone).toBe(true)
    expect(config.action).toBe('warn')
  })

  it('returns stored config', async () => {
    await setGuardrailConfig({ enabled: false, action: 'mask' })

    const config = await getGuardrailConfig()

    expect(config.enabled).toBe(false)
    expect(config.action).toBe('mask')
  })
})

describe('setGuardrailConfig', () => {
  it('saves partial config', async () => {
    await setGuardrailConfig({ enabled: false })

    const config = await getGuardrailConfig()

    expect(config.enabled).toBe(false)
    expect(config.types.email).toBe(true)
  })

  it('merges with existing config', async () => {
    await setGuardrailConfig({ action: 'mask' })
    await setGuardrailConfig({ enabled: false })

    const config = await getGuardrailConfig()

    expect(config.action).toBe('mask')
    expect(config.enabled).toBe(false)
  })
})
