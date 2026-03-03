import { describe, it, expect } from 'vitest'
import { formatTime, calculateRemainingTime } from '../timeFormat'

describe('formatTime', () => {
  describe('Korean locale', () => {
    it('formats seconds under 60', () => {
      expect(formatTime(0, 'ko')).toBe('0초')
      expect(formatTime(30, 'ko')).toBe('30초')
      expect(formatTime(59, 'ko')).toBe('59초')
    })

    it('formats exact minutes', () => {
      expect(formatTime(60, 'ko')).toBe('1분')
      expect(formatTime(120, 'ko')).toBe('2분')
      expect(formatTime(300, 'ko')).toBe('5분')
    })

    it('formats minutes and seconds', () => {
      expect(formatTime(90, 'ko')).toBe('1분 30초')
      expect(formatTime(125, 'ko')).toBe('2분 5초')
      expect(formatTime(185, 'ko')).toBe('3분 5초')
    })

    it('rounds fractional seconds', () => {
      expect(formatTime(30.4, 'ko')).toBe('30초')
      expect(formatTime(30.6, 'ko')).toBe('31초')
      expect(formatTime(90.7, 'ko')).toBe('1분 31초')
    })
  })

  describe('English locale', () => {
    it('formats seconds under 60', () => {
      expect(formatTime(0, 'en')).toBe('0s')
      expect(formatTime(30, 'en')).toBe('30s')
      expect(formatTime(59, 'en')).toBe('59s')
    })

    it('formats exact minutes', () => {
      expect(formatTime(60, 'en')).toBe('1m')
      expect(formatTime(120, 'en')).toBe('2m')
    })

    it('formats minutes and seconds', () => {
      expect(formatTime(90, 'en')).toBe('1m 30s')
      expect(formatTime(125, 'en')).toBe('2m 5s')
    })
  })

  describe('Japanese locale', () => {
    it('formats seconds under 60', () => {
      expect(formatTime(30, 'ja')).toBe('30秒')
    })

    it('formats exact minutes', () => {
      expect(formatTime(60, 'ja')).toBe('1分')
    })

    it('formats minutes and seconds', () => {
      expect(formatTime(90, 'ja')).toBe('1分 30秒')
    })
  })

  describe('default locale', () => {
    it('defaults to Korean when no locale specified', () => {
      expect(formatTime(90)).toBe('1분 30초')
    })
  })
})

describe('calculateRemainingTime', () => {
  it('returns null when no chunks completed', () => {
    expect(calculateRemainingTime(0, 10, [])).toBeNull()
  })

  it('returns null when chunk times is empty', () => {
    expect(calculateRemainingTime(5, 10, [])).toBeNull()
  })

  it('calculates remaining time based on average chunk time', () => {
    // Each chunk takes 2000ms (2s)
    const chunkTimes = [2000, 2000, 2000]
    const result = calculateRemainingTime(3, 10, chunkTimes)

    // Remaining: 7 chunks * 2s = 14s
    expect(result).toBe(14)
  })

  it('handles varying chunk times', () => {
    // Chunks take 1s, 2s, 3s (average: 2s)
    const chunkTimes = [1000, 2000, 3000]
    const result = calculateRemainingTime(3, 8, chunkTimes)

    // Average: 2000ms, remaining: 5 chunks * 2s = 10s
    expect(result).toBe(10)
  })

  it('rounds to nearest second', () => {
    // Average: 1500ms (1.5s)
    const chunkTimes = [1500, 1500]
    const result = calculateRemainingTime(2, 5, chunkTimes)

    // Remaining: 3 chunks * 1.5s = 4.5s → rounds to 5s
    expect(result).toBe(5)
  })

  it('returns 0 when all chunks completed', () => {
    const chunkTimes = [1000, 1000, 1000]
    const result = calculateRemainingTime(3, 3, chunkTimes)
    expect(result).toBe(0)
  })

  it('handles single chunk completion', () => {
    const chunkTimes = [3000]
    const result = calculateRemainingTime(1, 5, chunkTimes)

    // Remaining: 4 chunks * 3s = 12s
    expect(result).toBe(12)
  })
})
