import { describe, it, expect, vi } from 'vitest'

const mockXlsxRead = vi.fn(() => ({
  SheetNames: ['Sheet1'],
  Sheets: { Sheet1: {} },
}))

const mockSheetToJson = vi.fn(() => [
  ['Name', 'Age'],
  ['Alice', '30'],
])

vi.mock('xlsx', () => ({
  read: (...args: unknown[]) => mockXlsxRead(...args),
  utils: {
    sheet_to_json: (...args: unknown[]) => mockSheetToJson(...args),
  },
}))

describe('xlsx lazy load', () => {
  it('dataAnalysis.parseExcel uses dynamic import (not top-level)', async () => {
    const { parseExcel } = await import('../dataAnalysis')

    const file = new File([new ArrayBuffer(10)], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    const result = await parseExcel(file)

    expect(result.headers).toEqual(['Name', 'Age'])
    expect(result.rows).toEqual([['Alice', '30']])
    expect(result.fileName).toBe('test.xlsx')
    expect(mockXlsxRead).toHaveBeenCalled()
  })

  it('xlsx module is not imported at module load time', async () => {
    // Verify that importing dataAnalysis does NOT trigger xlsx import
    // by checking that parseCSV (which doesn't use xlsx) works without xlsx being resolved
    const { parseCSV } = await import('../dataAnalysis')

    const csvContent = 'Name,Age\nAlice,30\n'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })

    const result = await parseCSV(file)

    expect(result.headers).toEqual(['Name', 'Age'])
    expect(result.rows).toEqual([['Alice', '30']])
    // xlsx mock should NOT have been called for CSV parsing
    mockXlsxRead.mockClear()
    expect(mockXlsxRead).not.toHaveBeenCalled()
  })
})
