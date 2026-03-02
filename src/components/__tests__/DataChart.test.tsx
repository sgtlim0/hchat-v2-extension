import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { DataChart } from '../DataChart'
import type { ChartData } from '../../lib/chartDataExtractor'

function makeChart(overrides: Partial<ChartData> = {}): ChartData {
  return {
    title: 'Sales',
    xLabel: 'Product',
    yLabel: 'Sales',
    type: 'bar',
    points: [
      { label: 'A', value: 100 },
      { label: 'B', value: 200 },
      { label: 'C', value: 150 },
    ],
    ...overrides,
  }
}

describe('DataChart', () => {
  it('bar 차트를 렌더링한다', () => {
    const { container } = render(<DataChart chart={makeChart()} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    // Should have 3 bars (rect elements inside the chart area)
    const rects = svg!.querySelectorAll('rect')
    // 3 bars + grid/tooltip rects possible, at least 3
    expect(rects.length).toBeGreaterThanOrEqual(3)
  })

  it('line 차트를 렌더링한다', () => {
    const chart = makeChart({ type: 'line' })
    const { container } = render(<DataChart chart={chart} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    // Should have circles for dots
    const circles = svg!.querySelectorAll('circle')
    expect(circles.length).toBe(3)
    // Should have a path for the line
    const paths = svg!.querySelectorAll('path')
    expect(paths.length).toBeGreaterThanOrEqual(1)
  })

  it('빈 포인트 배열이면 렌더링하지 않는다', () => {
    const chart = makeChart({ points: [] })
    const { container } = render(<DataChart chart={chart} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeNull()
  })

  it('차트 제목을 표시한다', () => {
    const { container } = render(<DataChart chart={makeChart({ title: 'Revenue' })} />)
    const texts = container.querySelectorAll('text')
    const titleText = Array.from(texts).find((t) => t.textContent === 'Revenue')
    expect(titleText).toBeTruthy()
  })

  it('커스텀 크기를 적용한다', () => {
    const { container } = render(<DataChart chart={makeChart()} width={400} height={200} />)
    const svg = container.querySelector('svg')
    expect(svg!.getAttribute('width')).toBe('400')
    expect(svg!.getAttribute('height')).toBe('200')
  })
})
