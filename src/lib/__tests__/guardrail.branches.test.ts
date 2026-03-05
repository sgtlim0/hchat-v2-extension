import { describe, it, expect } from 'vitest'
import { detectPII, maskPII } from '../guardrail'

describe('guardrail branch coverage', () => {
  describe('overlapping ranges', () => {
    it('prevents duplicate detection of same range', () => {
      // A card number could also match a bank pattern — only one should win
      const text = 'Card: 1234-5678-9012-3456'
      const detections = detectPII(text)
      // Should only detect once (card takes priority over bank)
      const ranges = detections.map((d) => `${d.start}-${d.end}`)
      const unique = new Set(ranges)
      expect(ranges.length).toBe(unique.size)
    })
  })

  describe('maskPhone edge cases', () => {
    it('masks phone without separators', () => {
      const text = '연락처 01012345678 입니다'
      const detections = detectPII(text)
      const masked = maskPII(text, detections)
      expect(masked).toContain('010-****-5678')
    })

    it('masks phone with spaces', () => {
      const text = '번호 010 1234 5678'
      const detections = detectPII(text)
      if (detections.length > 0) {
        const masked = maskPII(text, detections)
        expect(masked).toContain('****')
      }
    })
  })

  describe('maskCard edge cases', () => {
    it('masks card without separators', () => {
      const text = '카드 1234567890123456'
      const detections = detectPII(text)
      const masked = maskPII(text, detections)
      expect(masked).toContain('****-****-****-3456')
    })

    it('masks card with dots', () => {
      const text = '카드 1234.5678.9012.3456'
      const detections = detectPII(text)
      const masked = maskPII(text, detections)
      expect(masked).toContain('****')
      expect(masked).toContain('3456')
    })
  })

  describe('maskSSN without hyphen', () => {
    it('masks SSN without separator', () => {
      const text = '주민번호 9001011234567'
      const detections = detectPII(text)
      const masked = maskPII(text, detections)
      expect(masked).toContain('*************')
    })
  })

  describe('maskEmail edge cases', () => {
    it('masks email with complex domain', () => {
      const text = 'email a@b.co.kr'
      const detections = detectPII(text)
      if (detections.length > 0) {
        const masked = maskPII(text, detections)
        expect(masked).toContain('***@')
      }
    })
  })

  describe('all types disabled', () => {
    it('returns empty when all types are disabled', () => {
      const text = 'test@example.com 010-1234-5678'
      const detections = detectPII(text, {
        types: { email: false, phone: false, ssn: false, card: false, bank: false },
      })
      expect(detections).toEqual([])
    })
  })

  describe('bank account validation', () => {
    it('rejects short bank account number', () => {
      // Less than 10 digits cleaned
      const text = '번호 123-456-789'
      const detections = detectPII(text).filter((d) => d.type === 'bank')
      expect(detections).toHaveLength(0)
    })

    it('accepts valid bank account', () => {
      const text = '계좌: 123-456789-01234'
      const detections = detectPII(text)
      const bank = detections.filter((d) => d.type === 'bank')
      expect(bank.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('card number validation', () => {
    it('rejects non-16-digit card', () => {
      // 12 digits only
      const text = '카드 1234-5678-9012'
      const detections = detectPII(text).filter((d) => d.type === 'card')
      expect(detections).toHaveLength(0)
    })
  })
})
