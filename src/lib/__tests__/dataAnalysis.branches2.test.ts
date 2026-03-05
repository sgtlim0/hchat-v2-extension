import { describe, it, expect, vi } from 'vitest'
import { parseCSV, parseExcel, parseDataFile, DataAnalysisError } from '../dataAnalysis'

// Mock xlsx dynamic import
vi.mock('xlsx', () => {
  const mockSheetToJson = vi.fn()
  return {
    default: {
      read: vi.fn(),
      utils: { sheet_to_json: mockSheetToJson },
    },
    read: vi.fn(),
    utils: { sheet_to_json: mockSheetToJson },
  }
})

function makeFile(name: string, content: string, size?: number): File {
  const blob = new Blob([content], { type: 'text/plain' })
  const file = new File([blob], name, { type: 'text/plain' })
  if (size !== undefined) {
    Object.defineProperty(file, 'size', { value: size })
  }
  return file
}

function makeExcelFile(name: string, size?: number): File {
  const buffer = new ArrayBuffer(8)
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const file = new File([blob], name, { type: blob.type })
  if (size !== undefined) {
    Object.defineProperty(file, 'size', { value: size })
  }
  return file
}

describe('parseCSV — FileReader onerror branch', () => {
  it('rejects when FileReader triggers onerror', async () => {
    const file = makeFile('fail.csv', 'A,B\n1,2')

    // Override FileReader to simulate read error
    const OriginalFileReader = globalThis.FileReader

    class MockFileReader {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      result: string | null = null

      readAsText() {
        setTimeout(() => {
          if (this.onerror) this.onerror()
        }, 0)
      }
    }

    globalThis.FileReader = MockFileReader as unknown as typeof FileReader

    try {
      await expect(parseCSV(file)).rejects.toThrow('파일 읽기 실패')
    } finally {
      globalThis.FileReader = OriginalFileReader
    }
  })
})

describe('parseExcel', () => {
  it('parses a valid Excel file with multiple rows', async () => {
    const XLSX = await import('xlsx')
    const mockRead = vi.mocked(XLSX.read ?? XLSX.default.read)
    const mockSheetToJson = vi.mocked(XLSX.utils?.sheet_to_json ?? XLSX.default.utils.sheet_to_json)

    mockRead.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: {} },
    } as never)

    mockSheetToJson.mockReturnValue([
      ['Name', 'Age'],
      ['Alice', 30],
      ['Bob', 25],
    ] as never)

    const file = makeExcelFile('data.xlsx')
    const result = await parseExcel(file)

    expect(result.headers).toEqual(['Name', 'Age'])
    expect(result.rows).toEqual([['Alice', '30'], ['Bob', '25']])
    expect(result.rowCount).toBe(2)
    expect(result.fileName).toBe('data.xlsx')
  })

  it('throws for oversized Excel file', async () => {
    const file = makeExcelFile('big.xlsx', 6 * 1024 * 1024)
    await expect(parseExcel(file)).rejects.toThrow('파일 크기가 5MB를 초과')
  })

  it('throws when workbook has no sheets', async () => {
    const XLSX = await import('xlsx')
    const mockRead = vi.mocked(XLSX.read ?? XLSX.default.read)

    mockRead.mockReturnValue({
      SheetNames: [],
      Sheets: {},
    } as never)

    const file = makeExcelFile('empty.xlsx')
    await expect(parseExcel(file)).rejects.toThrow('Excel 파일에 시트가 없습니다')
  })

  it('throws when data has fewer than 2 rows', async () => {
    const XLSX = await import('xlsx')
    const mockRead = vi.mocked(XLSX.read ?? XLSX.default.read)
    const mockSheetToJson = vi.mocked(XLSX.utils?.sheet_to_json ?? XLSX.default.utils.sheet_to_json)

    mockRead.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: {} },
    } as never)

    mockSheetToJson.mockReturnValue([
      ['Name', 'Age'],
    ] as never)

    const file = makeExcelFile('header-only.xlsx')
    await expect(parseExcel(file)).rejects.toThrow('데이터가 부족합니다')
  })

  it('throws when headers have fewer than MIN_COLUMNS', async () => {
    const XLSX = await import('xlsx')
    const mockRead = vi.mocked(XLSX.read ?? XLSX.default.read)
    const mockSheetToJson = vi.mocked(XLSX.utils?.sheet_to_json ?? XLSX.default.utils.sheet_to_json)

    mockRead.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: {} },
    } as never)

    mockSheetToJson.mockReturnValue([
      ['OnlyCol'],
      ['val1'],
    ] as never)

    const file = makeExcelFile('single-col.xlsx')
    await expect(parseExcel(file)).rejects.toThrow('열이 2개 이상')
  })

  it('handles missing cell values with empty string fallback', async () => {
    const XLSX = await import('xlsx')
    const mockRead = vi.mocked(XLSX.read ?? XLSX.default.read)
    const mockSheetToJson = vi.mocked(XLSX.utils?.sheet_to_json ?? XLSX.default.utils.sheet_to_json)

    mockRead.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: {} },
    } as never)

    // Row with fewer cells than headers — triggers row[i] ?? '' fallback (line 112-113)
    mockSheetToJson.mockReturnValue([
      ['Name', 'Age', 'Score'],
      ['Alice'],           // Age and Score are undefined
      ['Bob', 25],         // Score is undefined
    ] as never)

    const file = makeExcelFile('sparse.xlsx')
    const result = await parseExcel(file)

    expect(result.headers).toEqual(['Name', 'Age', 'Score'])
    expect(result.rows[0]).toEqual(['Alice', '', ''])
    expect(result.rows[1]).toEqual(['Bob', '25', ''])
  })

  it('converts non-string header values to strings', async () => {
    const XLSX = await import('xlsx')
    const mockRead = vi.mocked(XLSX.read ?? XLSX.default.read)
    const mockSheetToJson = vi.mocked(XLSX.utils?.sheet_to_json ?? XLSX.default.utils.sheet_to_json)

    mockRead.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: {} },
    } as never)

    mockSheetToJson.mockReturnValue([
      [1, 2],
      ['a', 'b'],
    ] as never)

    const file = makeExcelFile('numeric-headers.xlsx')
    const result = await parseExcel(file)

    expect(result.headers).toEqual(['1', '2'])
  })

  it('limits rows to MAX_ROWS (10000)', async () => {
    const XLSX = await import('xlsx')
    const mockRead = vi.mocked(XLSX.read ?? XLSX.default.read)
    const mockSheetToJson = vi.mocked(XLSX.utils?.sheet_to_json ?? XLSX.default.utils.sheet_to_json)

    mockRead.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: {} },
    } as never)

    const header = ['Col1', 'Col2']
    const dataRows = Array.from({ length: 10500 }, (_, i) => [`row${i}`, `val${i}`])
    mockSheetToJson.mockReturnValue([header, ...dataRows] as never)

    const file = makeExcelFile('huge.xlsx')
    const result = await parseExcel(file)

    expect(result.rowCount).toBeLessThanOrEqual(10000)
  })
})

describe('parseDataFile — Excel routing', () => {
  it('routes .xlsx files to parseExcel', async () => {
    const XLSX = await import('xlsx')
    const mockRead = vi.mocked(XLSX.read ?? XLSX.default.read)
    const mockSheetToJson = vi.mocked(XLSX.utils?.sheet_to_json ?? XLSX.default.utils.sheet_to_json)

    mockRead.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: {} },
    } as never)

    mockSheetToJson.mockReturnValue([
      ['A', 'B'],
      [1, 2],
    ] as never)

    const file = makeExcelFile('test.xlsx')
    const result = await parseDataFile(file)
    expect(result.headers).toEqual(['A', 'B'])
  })

  it('routes .xls files to parseExcel', async () => {
    const XLSX = await import('xlsx')
    const mockRead = vi.mocked(XLSX.read ?? XLSX.default.read)
    const mockSheetToJson = vi.mocked(XLSX.utils?.sheet_to_json ?? XLSX.default.utils.sheet_to_json)

    mockRead.mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: {} },
    } as never)

    mockSheetToJson.mockReturnValue([
      ['X', 'Y'],
      [10, 20],
    ] as never)

    const file = makeExcelFile('legacy.xls')
    const result = await parseDataFile(file)
    expect(result.headers).toEqual(['X', 'Y'])
    expect(result.fileName).toBe('legacy.xls')
  })
})
