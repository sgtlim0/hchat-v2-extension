import { describe, it, expect } from 'vitest'
import { dataToMarkdownTable, generateAnalysisPrompt, DataAnalysisError } from '../dataAnalysis'
import type { ParsedData, AnalysisType } from '../dataAnalysis'

function makeParsedData(overrides?: Partial<ParsedData>): ParsedData {
  return {
    headers: ['Name', 'Age', 'Score'],
    rows: [
      ['Alice', '30', '85'],
      ['Bob', '25', '92'],
      ['Charlie', '35', '78'],
    ],
    rowCount: 3,
    fileName: 'test.csv',
    ...overrides,
  }
}

describe('DataAnalysisError', () => {
  it('name이 DataAnalysisError', () => {
    const err = new DataAnalysisError('test')
    expect(err.name).toBe('DataAnalysisError')
    expect(err.message).toBe('test')
    expect(err).toBeInstanceOf(Error)
  })
})

describe('dataToMarkdownTable', () => {
  it('기본 마크다운 테이블 생성', () => {
    const data = makeParsedData()
    const result = dataToMarkdownTable(data)
    expect(result).toContain('| Name | Age | Score |')
    expect(result).toContain('| --- | --- | --- |')
    expect(result).toContain('| Alice | 30 | 85 |')
    expect(result).toContain('| Bob | 25 | 92 |')
    expect(result).toContain('| Charlie | 35 | 78 |')
  })

  it('maxRows로 행 수 제한', () => {
    const data = makeParsedData()
    const result = dataToMarkdownTable(data, 2)
    expect(result).toContain('| Alice | 30 | 85 |')
    expect(result).toContain('| Bob | 25 | 92 |')
    expect(result).not.toContain('Charlie')
    expect(result).toContain('... 외 1행')
  })

  it('maxRows 이하면 추가 메시지 없음', () => {
    const data = makeParsedData()
    const result = dataToMarkdownTable(data, 10)
    expect(result).not.toContain('... 외')
  })

  it('빈 rows', () => {
    const data = makeParsedData({ rows: [], rowCount: 0 })
    const result = dataToMarkdownTable(data)
    const lines = result.split('\n')
    expect(lines).toHaveLength(2) // header + divider
  })

  it('기본 maxRows는 20', () => {
    const rows = Array.from({ length: 25 }, (_, i) => [`row${i}`, `${i}`, `${i * 10}`])
    const data = makeParsedData({ rows, rowCount: 25 })
    const result = dataToMarkdownTable(data)
    expect(result).toContain('... 외 5행')
  })
})

describe('generateAnalysisPrompt', () => {
  const data = makeParsedData()

  it('한국어 summary 프롬프트', () => {
    const prompt = generateAnalysisPrompt(data, 'summary', 'ko')
    expect(prompt).toContain('요약 통계')
    expect(prompt).toContain('test.csv')
    expect(prompt).toContain('Name, Age, Score')
    expect(prompt).toContain('총 3행')
  })

  it('영어 summary 프롬프트', () => {
    const prompt = generateAnalysisPrompt(data, 'summary', 'en')
    expect(prompt).toContain('summary statistics')
    expect(prompt).toContain('test.csv')
  })

  it('한국어 trend 프롬프트', () => {
    const prompt = generateAnalysisPrompt(data, 'trend', 'ko')
    expect(prompt).toContain('트렌드')
  })

  it('영어 trend 프롬프트', () => {
    const prompt = generateAnalysisPrompt(data, 'trend', 'en')
    expect(prompt).toContain('trends')
  })

  it('한국어 outlier 프롬프트', () => {
    const prompt = generateAnalysisPrompt(data, 'outlier', 'ko')
    expect(prompt).toContain('이상치')
  })

  it('영어 outlier 프롬프트', () => {
    const prompt = generateAnalysisPrompt(data, 'outlier', 'en')
    expect(prompt).toContain('outlier')
  })

  it('마크다운 테이블이 프롬프트에 포함', () => {
    const prompt = generateAnalysisPrompt(data, 'summary', 'ko')
    expect(prompt).toContain('| Name | Age | Score |')
    expect(prompt).toContain('| Alice | 30 | 85 |')
  })

  it('모든 AnalysisType 처리', () => {
    const types: AnalysisType[] = ['summary', 'trend', 'outlier']
    for (const type of types) {
      const prompt = generateAnalysisPrompt(data, type, 'ko')
      expect(prompt.length).toBeGreaterThan(50)
    }
  })
})
