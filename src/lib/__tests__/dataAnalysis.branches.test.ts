import { describe, it, expect } from 'vitest'
import { parseDataFile, DataAnalysisError } from '../dataAnalysis'

// Test internal functions via parseCSV/parseDataFile
function makeFile(name: string, content: string, size?: number): File {
  const blob = new Blob([content], { type: 'text/plain' })
  const file = new File([blob], name, { type: 'text/plain' })
  if (size !== undefined) {
    Object.defineProperty(file, 'size', { value: size })
  }
  return file
}

describe('parseDataFile', () => {
  it('routes .csv files to parseCSV', async () => {
    const file = makeFile('test.csv', 'Name,Age\nAlice,30\nBob,25')
    const result = await parseDataFile(file)
    expect(result.headers).toEqual(['Name', 'Age'])
    expect(result.rows).toHaveLength(2)
    expect(result.fileName).toBe('test.csv')
  })

  it('routes .tsv files to parseCSV', async () => {
    const file = makeFile('test.tsv', 'Name\tAge\nAlice\t30\nBob\t25')
    const result = await parseDataFile(file)
    expect(result.headers).toEqual(['Name', 'Age'])
    expect(result.rows).toHaveLength(2)
  })

  it('throws for unsupported format', () => {
    const file = makeFile('test.json', '{}')
    expect(() => parseDataFile(file)).toThrow('지원하지 않는 파일 형식')
  })

  it('throws for file without extension', () => {
    const file = makeFile('test', 'data')
    expect(() => parseDataFile(file)).toThrow('지원하지 않는 파일 형식')
  })
})

describe('parseCSV', () => {
  it('throws for oversized file', async () => {
    const file = makeFile('big.csv', 'a,b\n1,2', 6 * 1024 * 1024)
    await expect(parseDataFile(file)).rejects.toThrow('파일 크기가 5MB를 초과')
  })

  it('throws for insufficient data (only header)', async () => {
    const file = makeFile('empty.csv', 'Name,Age')
    await expect(parseDataFile(file)).rejects.toThrow('데이터가 부족합니다')
  })

  it('throws for single column', async () => {
    const file = makeFile('single.csv', 'Name\nAlice\nBob')
    await expect(parseDataFile(file)).rejects.toThrow('열이 2개 이상')
  })

  it('handles quoted fields with commas', async () => {
    const file = makeFile('quoted.csv', 'Name,City\n"Kim, John","Seoul, Korea"\nBob,NYC')
    const result = await parseDataFile(file)
    expect(result.rows[0]).toEqual(['Kim, John', 'Seoul, Korea'])
  })

  it('handles escaped quotes in CSV', async () => {
    const file = makeFile('escaped.csv', 'Name,Quote\nAlice,"He said ""hello"""\nBob,test')
    const result = await parseDataFile(file)
    expect(result.rows[0][1]).toBe('He said "hello"')
  })

  it('detects tab delimiter', async () => {
    const file = makeFile('tab.csv', 'Name\tAge\nAlice\t30\nBob\t25')
    const result = await parseDataFile(file)
    expect(result.headers).toEqual(['Name', 'Age'])
  })

  it('limits to MAX_ROWS', async () => {
    const header = 'A,B'
    const rows = Array.from({ length: 11000 }, (_, i) => `${i},val`)
    const file = makeFile('large.csv', [header, ...rows].join('\n'))
    const result = await parseDataFile(file)
    expect(result.rowCount).toBeLessThanOrEqual(10000)
  })

  it('ignores empty lines', async () => {
    const file = makeFile('spaces.csv', 'A,B\n\n1,2\n\n3,4\n')
    const result = await parseDataFile(file)
    expect(result.rowCount).toBe(2)
  })
})

describe('DataAnalysisError', () => {
  it('is an instance of Error', () => {
    const err = new DataAnalysisError('test')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('DataAnalysisError')
  })
})
