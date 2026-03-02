export interface ToolPanelProps {
  loading: boolean
  setLoading: (v: boolean) => void
  setResult: (v: string) => void
  runStream: (prompt: string, model?: string) => Promise<void>
  showToast: (msg: string) => void
  t: (key: string, params?: Record<string, unknown>) => string
  locale: string
}
