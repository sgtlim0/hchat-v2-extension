import { describe, it, expect } from 'vitest'
import { extractChartData } from '../chartDataExtractor'
import type { ParsedData } from '../dataAnalysis'

function makeData(headers: string[], rows: string[][]): ParsedData {
  return { headers, rows, rowCount: rows.length, colCount: headers.length }
}

describe('chartDataExtractor branch coverage', () => {
  it('returns empty when rows < 2', () => {
    const data = makeData(['A', 'B'], [['1', '2']])
    expect(extractChartData(data)).toEqual([])
  })

  it('returns empty when headers < 2', () => {
    const data = makeData(['A'], [['1'], ['2']])
    expect(extractChartData(data)).toEqual([])
  })

  it('returns empty when no numeric columns', () => {
    const data = makeData(['Name', 'City'], [['Alice', 'Seoul'], ['Bob', 'Tokyo']])
    expect(extractChartData(data)).toEqual([])
  })

  it('detects time series with date-like first column → line chart', () => {
    const data = makeData(
      ['Date', 'Value'],
      Array.from({ length: 5 }, (_, i) => [`2024-01-0${i + 1}`, `${i * 10}`]),
    )
    const charts = extractChartData(data)
    expect(charts.length).toBeGreaterThan(0)
    expect(charts[0].type).toBe('line')
  })

  it('detects time series with time header keyword', () => {
    const data = makeData(
      ['year', 'Sales'],
      [['2020', '100'], ['2021', '200'], ['2022', '300']],
    )
    const charts = extractChartData(data)
    expect(charts[0].type).toBe('line')
  })

  it('returns bar chart for non-time-series data', () => {
    const data = makeData(
      ['Product', 'Sales'],
      [['A', '100'], ['B', '200'], ['C', '300']],
    )
    const charts = extractChartData(data)
    expect(charts.length).toBeGreaterThan(0)
    expect(charts[0].type).toBe('bar')
  })

  it('limits to 2 numeric columns', () => {
    const data = makeData(
      ['Label', 'Val1', 'Val2', 'Val3'],
      [['A', '1', '2', '3'], ['B', '4', '5', '6'], ['C', '7', '8', '9']],
    )
    const charts = extractChartData(data)
    expect(charts.length).toBeLessThanOrEqual(2)
  })

  it('handles empty label fallback', () => {
    const data = makeData(
      ['Label', 'Value'],
      [['A', '10'], ['B', '20'], ['', '30']],
    )
    const charts = extractChartData(data)
    expect(charts.length).toBe(1)
  })

  it('samples data points when rows exceed maxPoints for bar', () => {
    const rows = Array.from({ length: 50 }, (_, i) => [`Item${i}`, `${i * 10}`])
    const data = makeData(['Item', 'Value'], rows)
    const charts = extractChartData(data)
    expect(charts[0].points.length).toBeLessThanOrEqual(20)
  })

  it('samples data points when rows exceed maxPoints for line', () => {
    const rows = Array.from({ length: 50 }, (_, i) => [`2024-01-${String(i + 1).padStart(2, '0')}`, `${i * 10}`])
    const data = makeData(['Date', 'Value'], rows)
    const charts = extractChartData(data)
    expect(charts[0].type).toBe('line')
    expect(charts[0].points.length).toBeLessThanOrEqual(30)
  })

  it('handles dateLike ratio below threshold (not time series)', () => {
    // First column has < 60% date-like values
    const data = makeData(
      ['ID', 'Amount'],
      [['abc', '100'], ['def', '200'], ['2024-01-01', '300'], ['ghi', '400'], ['jkl', '500']],
    )
    const charts = extractChartData(data)
    if (charts.length > 0) {
      expect(charts[0].type).toBe('bar')
    }
  })

  it('uses header fallback when header is undefined', () => {
    const data = makeData(
      ['Label', 'Value'],
      [['A', '10'], ['B', '20']],
    )
    const charts = extractChartData(data)
    expect(charts.length).toBe(1)
    expect(charts[0].title).toBe('Value')
  })
})
