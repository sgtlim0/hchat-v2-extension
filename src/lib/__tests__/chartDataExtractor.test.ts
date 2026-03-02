import { describe, it, expect } from 'vitest'
import { extractChartData } from '../chartDataExtractor'
import type { ParsedData } from '../dataAnalysis'

function makeParsedData(
  headers: string[],
  rows: string[][],
  fileName = 'test.csv'
): ParsedData {
  return { headers, rows, rowCount: rows.length, fileName }
}

describe('extractChartData', () => {
  it('빈 데이터에서 빈 배열을 반환한다', () => {
    const data = makeParsedData(['A', 'B'], [])
    expect(extractChartData(data)).toEqual([])
  })

  it('행이 1개뿐이면 빈 배열을 반환한다', () => {
    const data = makeParsedData(['Name', 'Value'], [['A', '10']])
    expect(extractChartData(data)).toEqual([])
  })

  it('숫자 열이 없으면 빈 배열을 반환한다', () => {
    const data = makeParsedData(
      ['Name', 'City'],
      [['Alice', 'Seoul'], ['Bob', 'Busan'], ['Charlie', 'Daegu']]
    )
    expect(extractChartData(data)).toEqual([])
  })

  it('카테고리 데이터에서 bar 차트를 추출한다', () => {
    const data = makeParsedData(
      ['Product', 'Sales', 'Profit'],
      [
        ['Widget A', '100', '30'],
        ['Widget B', '200', '50'],
        ['Widget C', '150', '40'],
      ]
    )
    const charts = extractChartData(data)
    expect(charts.length).toBe(2)
    expect(charts[0].type).toBe('bar')
    expect(charts[0].title).toBe('Sales')
    expect(charts[0].points).toHaveLength(3)
    expect(charts[0].points[0]).toEqual({ label: 'Widget A', value: 100 })
    expect(charts[1].title).toBe('Profit')
    expect(charts[1].type).toBe('bar')
  })

  it('날짜 형식 첫 열이면 line 차트를 추출한다', () => {
    const data = makeParsedData(
      ['Date', 'Revenue'],
      [
        ['2024-01-01', '1000'],
        ['2024-02-01', '1200'],
        ['2024-03-01', '1100'],
      ]
    )
    const charts = extractChartData(data)
    expect(charts.length).toBe(1)
    expect(charts[0].type).toBe('line')
    expect(charts[0].points).toHaveLength(3)
  })

  it('시간 관련 헤더명으로 line 차트를 감지한다', () => {
    const data = makeParsedData(
      ['월', '매출'],
      [
        ['1월', '500'],
        ['2월', '600'],
        ['3월', '700'],
      ]
    )
    const charts = extractChartData(data)
    expect(charts.length).toBe(1)
    expect(charts[0].type).toBe('line')
  })

  it('최대 2개 차트만 반환한다', () => {
    const data = makeParsedData(
      ['Category', 'A', 'B', 'C'],
      [
        ['X', '10', '20', '30'],
        ['Y', '40', '50', '60'],
        ['Z', '70', '80', '90'],
      ]
    )
    const charts = extractChartData(data)
    expect(charts.length).toBe(2)
  })

  it('숫자에 포함된 쉼표, $, % 등을 파싱한다', () => {
    const data = makeParsedData(
      ['Item', 'Price'],
      [
        ['A', '$1,000'],
        ['B', '$2,500'],
        ['C', '$3,200'],
      ]
    )
    const charts = extractChartData(data)
    expect(charts.length).toBe(1)
    expect(charts[0].points[0].value).toBe(1000)
    expect(charts[0].points[1].value).toBe(2500)
  })

  it('대량 데이터를 maxPoints로 샘플링한다', () => {
    const rows: string[][] = []
    for (let i = 0; i < 100; i++) {
      rows.push([`Item ${i}`, String(i * 10)])
    }
    const data = makeParsedData(['Name', 'Value'], rows)
    const charts = extractChartData(data)
    expect(charts.length).toBe(1)
    // bar chart: maxPoints = 20
    expect(charts[0].points.length).toBeLessThanOrEqual(20)
  })

  it('첫 열이 숫자여도 라벨로 사용한다', () => {
    const data = makeParsedData(
      ['ID', 'Score'],
      [
        ['1', '85'],
        ['2', '92'],
        ['3', '78'],
      ]
    )
    const charts = extractChartData(data)
    expect(charts.length).toBe(1)
    // ID column is used as label even though it's numeric
    expect(charts[0].points[0].label).toBe('1')
  })
})
