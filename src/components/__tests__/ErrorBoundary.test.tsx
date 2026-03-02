import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorBoundary from '../ErrorBoundary'

// Suppress console.error from React for error boundary tests
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

function ThrowError({ error }: { error: Error }) {
  throw error
}

describe('ErrorBoundary', () => {
  it('정상 children 렌더링', () => {
    render(
      <ErrorBoundary>
        <div>정상 콘텐츠</div>
      </ErrorBoundary>
    )
    expect(screen.getByText('정상 콘텐츠')).toBeDefined()
  })

  it('일반 에러 시 fallback UI 표시', () => {
    render(
      <ErrorBoundary>
        <ThrowError error={new Error('테스트 에러')} />
      </ErrorBoundary>
    )
    expect(screen.getByText('오류가 발생했습니다')).toBeDefined()
    expect(screen.getByText('테스트 에러')).toBeDefined()
    expect(screen.getByText('다시 시도')).toBeDefined()
  })

  it('chunk 로드 에러 감지', () => {
    render(
      <ErrorBoundary>
        <ThrowError error={new Error('Loading chunk abc123 failed')} />
      </ErrorBoundary>
    )
    expect(screen.getByText('업데이트가 감지되었습니다')).toBeDefined()
    expect(screen.getByText('새로고침')).toBeDefined()
  })

  it('dynamically imported module 에러 감지', () => {
    render(
      <ErrorBoundary>
        <ThrowError error={new Error('Failed to fetch dynamically imported module')} />
      </ErrorBoundary>
    )
    expect(screen.getByText('업데이트가 감지되었습니다')).toBeDefined()
  })

  it('일반 에러에서 다시 시도 클릭 시 복구', () => {
    let shouldThrow = true
    function MaybeThrow() {
      if (shouldThrow) throw new Error('일시 오류')
      return <div>복구됨</div>
    }

    render(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>
    )
    expect(screen.getByText('오류가 발생했습니다')).toBeDefined()

    shouldThrow = false
    fireEvent.click(screen.getByText('다시 시도'))
    expect(screen.getByText('복구됨')).toBeDefined()
  })

  it('chunk 에러에서 새로고침 클릭 시 reload 호출', () => {
    const reloadMock = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
    })

    render(
      <ErrorBoundary>
        <ThrowError error={new Error('Loading chunk failed')} />
      </ErrorBoundary>
    )

    fireEvent.click(screen.getByText('새로고침'))
    expect(reloadMock).toHaveBeenCalled()
  })

  it('커스텀 fallback 사용', () => {
    render(
      <ErrorBoundary fallback={<div>커스텀 에러 UI</div>}>
        <ThrowError error={new Error('오류')} />
      </ErrorBoundary>
    )
    expect(screen.getByText('커스텀 에러 UI')).toBeDefined()
  })
})
