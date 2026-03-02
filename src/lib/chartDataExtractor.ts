// lib/chartDataExtractor.ts — Extract chart-worthy data from ParsedData

import type { ParsedData } from './dataAnalysis'

export interface ChartDataPoint {
  label: string
  value: number
}

export interface ChartData {
  title: string
  xLabel: string
  yLabel: string
  points: ChartDataPoint[]
  type: 'bar' | 'line'
}

/** Date-like patterns: YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD, MM/DD, etc. */
const DATE_PATTERN = /^\d{2,4}[-/.]\d{1,2}([-/.]\d{1,2})?$/

/** Time-related header names (case-insensitive) */
const TIME_HEADERS = /^(date|time|year|month|day|week|quarter|기간|날짜|연도|월|일|주|분기|시간)$/i

function isNumeric(value: string): boolean {
  if (value === '' || value === '-') return false
  const cleaned = value.replace(/[,%$₩원달러]/g, '').trim()
  return cleaned !== '' && !isNaN(Number(cleaned))
}

function parseNumericValue(value: string): number {
  const cleaned = value.replace(/[,%$₩원달러]/g, '').trim()
  return Number(cleaned) || 0
}

function isDateLike(value: string): boolean {
  return DATE_PATTERN.test(value.trim())
}

function isTimeHeader(header: string): boolean {
  return TIME_HEADERS.test(header.trim())
}

/**
 * Detect which columns are numeric by sampling rows.
 * Returns indices of columns where >70% of non-empty values are numeric.
 */
function detectNumericColumns(data: ParsedData): number[] {
  const { headers, rows } = data
  const sampleSize = Math.min(rows.length, 50)
  const sampleRows = rows.slice(0, sampleSize)

  const numericIndices: number[] = []

  for (let col = 0; col < headers.length; col++) {
    let numericCount = 0
    let nonEmptyCount = 0

    for (const row of sampleRows) {
      const val = row[col] ?? ''
      if (val.trim() === '') continue
      nonEmptyCount++
      if (isNumeric(val)) numericCount++
    }

    if (nonEmptyCount > 0 && numericCount / nonEmptyCount >= 0.7) {
      numericIndices.push(col)
    }
  }

  return numericIndices
}

/**
 * Detect if the first column is time-series data.
 */
function detectTimeSeries(data: ParsedData): boolean {
  const { headers, rows } = data
  if (rows.length < 2) return false

  const firstHeader = headers[0] ?? ''
  if (isTimeHeader(firstHeader)) return true

  const sampleSize = Math.min(rows.length, 20)
  let dateLikeCount = 0
  for (let i = 0; i < sampleSize; i++) {
    const val = rows[i]?.[0] ?? ''
    if (isDateLike(val)) dateLikeCount++
  }

  return dateLikeCount / sampleSize >= 0.6
}

/**
 * Extract chart data from parsed data.
 * Returns up to 2 charts: one per numeric column (using first column as label).
 */
export function extractChartData(data: ParsedData): ChartData[] {
  const { headers, rows } = data
  if (rows.length < 2 || headers.length < 2) return []

  const numericCols = detectNumericColumns(data)
  if (numericCols.length === 0) return []

  const isTimeSeries = detectTimeSeries(data)
  const labelColIndex = 0
  const chartType: 'bar' | 'line' = isTimeSeries ? 'line' : 'bar'

  // Use first column as label, pick up to 2 numeric columns for charts
  const valueCols = numericCols
    .filter((i) => i !== labelColIndex)
    .slice(0, 2)

  if (valueCols.length === 0) return []

  // Limit data points for readability
  const maxPoints = chartType === 'bar' ? 20 : 30
  const step = rows.length > maxPoints ? Math.ceil(rows.length / maxPoints) : 1

  const charts: ChartData[] = []

  for (const colIdx of valueCols) {
    const points: ChartDataPoint[] = []

    for (let i = 0; i < rows.length && points.length < maxPoints; i += step) {
      const row = rows[i]
      if (!row) continue
      const label = row[labelColIndex] ?? `${i + 1}`
      const value = parseNumericValue(row[colIdx] ?? '0')
      points.push({ label, value })
    }

    if (points.length >= 2) {
      charts.push({
        title: headers[colIdx] ?? `Column ${colIdx + 1}`,
        xLabel: headers[labelColIndex] ?? '',
        yLabel: headers[colIdx] ?? '',
        points,
        type: chartType,
      })
    }
  }

  return charts
}
