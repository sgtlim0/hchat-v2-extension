import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  isChunkError: boolean
}

function isChunkLoadError(error: Error): boolean {
  const msg = error.message.toLowerCase()
  return msg.includes('loading chunk') ||
    msg.includes('dynamically imported module') ||
    msg.includes('failed to fetch') ||
    msg.includes('loading css chunk')
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, isChunkError: false }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      isChunkError: isChunkLoadError(error),
    }
  }

  handleRetry = () => {
    if (this.state.isChunkError) {
      window.location.reload()
    } else {
      this.setState({ hasError: false, error: null, isChunkError: false })
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    const { isChunkError, error } = this.state

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 12,
        color: 'var(--text2)',
        textAlign: 'center',
      }}>
        <span style={{ fontSize: 28 }}>{isChunkError ? '🔄' : '⚠️'}</span>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text0)' }}>
          {isChunkError ? '업데이트가 감지되었습니다' : '오류가 발생했습니다'}
        </p>
        <p style={{ fontSize: 11, maxWidth: 280, lineHeight: 1.5 }}>
          {isChunkError
            ? '확장 프로그램이 업데이트되었습니다. 새로고침하면 정상 작동합니다.'
            : error?.message ?? '알 수 없는 오류'}
        </p>
        <button
          className="btn btn-primary btn-sm"
          onClick={this.handleRetry}
          style={{ marginTop: 4 }}
        >
          {isChunkError ? '새로고침' : '다시 시도'}
        </button>
      </div>
    )
  }
}
