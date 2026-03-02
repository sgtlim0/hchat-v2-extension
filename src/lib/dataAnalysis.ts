// lib/dataAnalysis.ts — CSV/Excel file parsing and analysis prompt generation

export interface ParsedData {
  headers: string[]
  rows: string[][]
  rowCount: number
  fileName: string
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_ROWS = 10_000
const MIN_COLUMNS = 2

export class DataAnalysisError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DataAnalysisError'
  }
}

function validateFile(file: File): void {
  if (file.size > MAX_FILE_SIZE) {
    throw new DataAnalysisError(`파일 크기가 5MB를 초과합니다 (${(file.size / 1024 / 1024).toFixed(1)}MB)`)
  }
}

function parseCSVText(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) throw new DataAnalysisError('데이터가 부족합니다 (최소 헤더 + 1행)')

  // Detect delimiter: comma or tab
  const firstLine = lines[0]
  const delimiter = firstLine.includes('\t') ? '\t' : ','

  const parseLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === delimiter && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseLine(lines[0])
  if (headers.length < MIN_COLUMNS) {
    throw new DataAnalysisError(`열이 ${MIN_COLUMNS}개 이상이어야 합니다 (현재 ${headers.length}개)`)
  }

  const rows = lines.slice(1, MAX_ROWS + 1).map(parseLine)

  return { headers, rows }
}

export async function parseCSV(file: File): Promise<ParsedData> {
  validateFile(file)

  const text = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new DataAnalysisError('파일 읽기 실패'))
    reader.readAsText(file)
  })

  const { headers, rows } = parseCSVText(text)

  return {
    headers,
    rows,
    rowCount: rows.length,
    fileName: file.name,
  }
}

export async function parseExcel(file: File): Promise<ParsedData> {
  validateFile(file)

  // Dynamic import xlsx to avoid bundle bloat
  const XLSX = await import('xlsx')

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new DataAnalysisError('Excel 파일에 시트가 없습니다')

  const sheet = workbook.Sheets[sheetName]
  const jsonData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })

  if (jsonData.length < 2) throw new DataAnalysisError('데이터가 부족합니다 (최소 헤더 + 1행)')

  const headers = (jsonData[0] ?? []).map(String)
  if (headers.length < MIN_COLUMNS) {
    throw new DataAnalysisError(`열이 ${MIN_COLUMNS}개 이상이어야 합니다 (현재 ${headers.length}개)`)
  }

  const rows = jsonData.slice(1, MAX_ROWS + 1).map((row) =>
    headers.map((_, i) => String(row[i] ?? ''))
  )

  return {
    headers,
    rows,
    rowCount: rows.length,
    fileName: file.name,
  }
}

export function parseDataFile(file: File): Promise<ParsedData> {
  const ext = file.name.toLowerCase().split('.').pop()
  if (ext === 'csv' || ext === 'tsv') return parseCSV(file)
  if (ext === 'xlsx' || ext === 'xls') return parseExcel(file)
  throw new DataAnalysisError('지원하지 않는 파일 형식입니다 (.csv, .xlsx, .xls)')
}

export function dataToMarkdownTable(data: ParsedData, maxRows = 20): string {
  const { headers, rows } = data
  const displayRows = rows.slice(0, maxRows)

  const headerLine = '| ' + headers.join(' | ') + ' |'
  const divider = '| ' + headers.map(() => '---').join(' | ') + ' |'
  const rowLines = displayRows.map((r) => '| ' + r.join(' | ') + ' |')

  const lines = [headerLine, divider, ...rowLines]
  if (rows.length > maxRows) {
    lines.push(`\n... 외 ${rows.length - maxRows}행`)
  }

  return lines.join('\n')
}

export type AnalysisType = 'summary' | 'trend' | 'outlier'

export function generateAnalysisPrompt(data: ParsedData, type: AnalysisType, locale: string): string {
  const preview = dataToMarkdownTable(data, 20)
  const meta = `파일: ${data.fileName}\n열: ${data.headers.join(', ')}\n총 ${data.rowCount}행`

  const isKo = locale === 'ko'

  const prompts: Record<AnalysisType, string> = {
    summary: isKo
      ? `다음 데이터를 분석하여 요약 통계를 제공해주세요:\n\n${meta}\n\n${preview}\n\n포함 항목:\n- 각 열의 데이터 타입과 기본 통계 (평균/중앙값/최대/최소)\n- 결측치 비율\n- 주요 패턴과 인사이트\n- Markdown 표 형식으로 정리`
      : `Analyze the following data and provide summary statistics:\n\n${meta}\n\n${preview}\n\nInclude:\n- Data type and basic statistics for each column (mean/median/max/min)\n- Missing value ratio\n- Key patterns and insights\n- Format as Markdown tables`,
    trend: isKo
      ? `다음 데이터에서 시간적 트렌드와 패턴을 분석해주세요:\n\n${meta}\n\n${preview}\n\n포함 항목:\n- 증가/감소 추세\n- 계절성 또는 주기적 패턴\n- 이상 시점\n- 예측 가능한 트렌드`
      : `Analyze temporal trends and patterns in the following data:\n\n${meta}\n\n${preview}\n\nInclude:\n- Growth/decline trends\n- Seasonality or cyclical patterns\n- Anomalous time points\n- Predictable trends`,
    outlier: isKo
      ? `다음 데이터에서 이상치와 특이점을 탐지해주세요:\n\n${meta}\n\n${preview}\n\n포함 항목:\n- 통계적 이상치 식별\n- 패턴에서 벗어난 데이터 포인트\n- 가능한 원인 분석\n- 데이터 품질 이슈`
      : `Detect outliers and anomalies in the following data:\n\n${meta}\n\n${preview}\n\nInclude:\n- Statistical outlier identification\n- Data points deviating from patterns\n- Possible cause analysis\n- Data quality issues`,
  }

  return prompts[type]
}
