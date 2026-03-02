// components/DataChart.tsx — Pure SVG chart for data analysis (bar & line)

import { useState } from 'react'
import type { ChartData } from '../lib/chartDataExtractor'

interface Props {
  chart: ChartData
  width?: number
  height?: number
}

const PADDING = { top: 24, right: 16, bottom: 36, left: 50 }
const BAR_COLOR = '#60a5fa'
const BAR_HOVER_COLOR = '#3b82f6'
const LINE_COLOR = '#60a5fa'
const LINE_DOT_COLOR = '#3b82f6'
const LINE_DOT_HOVER = '#2563eb'
const GRID_COLOR = 'rgba(255,255,255,0.06)'
const TEXT_COLOR = 'var(--text3)'
const TITLE_COLOR = 'var(--text1)'

export function DataChart({ chart, width = 320, height = 180 }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const { points, type, title } = chart
  if (points.length === 0) return null

  const chartW = width - PADDING.left - PADDING.right
  const chartH = height - PADDING.top - PADDING.bottom
  const maxVal = Math.max(...points.map((p) => p.value), 0.001)
  const minVal = Math.min(...points.map((p) => p.value), 0)
  const range = maxVal - Math.min(minVal, 0)

  // Y-axis ticks
  const yTicks = computeYTicks(range, 4)
  const yMax = yTicks[yTicks.length - 1] ?? range
  const yMin = minVal < 0 ? -yMax : 0

  function scaleY(val: number): number {
    return PADDING.top + chartH - ((val - yMin) / (yMax - yMin)) * chartH
  }

  function scaleX(i: number): number {
    if (points.length === 1) return PADDING.left + chartW / 2
    return PADDING.left + (i / (points.length - 1)) * chartW
  }

  const hovered = hoveredIdx !== null ? points[hoveredIdx] : null

  return (
    <div style={{ marginBottom: 8 }}>
      <svg
        width={width}
        height={height}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        {/* Title */}
        <text
          x={width / 2}
          y={12}
          textAnchor="middle"
          fontSize={11}
          fontWeight={600}
          fill={TITLE_COLOR}
        >
          {title}
        </text>

        {/* Grid lines */}
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={PADDING.left}
              y1={scaleY(v)}
              x2={width - PADDING.right}
              y2={scaleY(v)}
              stroke={GRID_COLOR}
              strokeDasharray="3,3"
            />
            <text
              x={PADDING.left - 4}
              y={scaleY(v) + 3}
              textAnchor="end"
              fontSize={9}
              fill={TEXT_COLOR}
              fontFamily="var(--mono)"
            >
              {formatTickValue(v)}
            </text>
          </g>
        ))}

        {/* Baseline */}
        <line
          x1={PADDING.left}
          y1={scaleY(0)}
          x2={width - PADDING.right}
          y2={scaleY(0)}
          stroke="rgba(255,255,255,0.12)"
        />

        {type === 'bar' ? renderBars() : renderLine()}

        {/* X-axis labels */}
        {points.map((p, i) => {
          const showLabel = points.length <= 15 || i % Math.ceil(points.length / 10) === 0
          if (!showLabel) return null
          const x = type === 'bar' ? barX(i) + barWidth() / 2 : scaleX(i)
          return (
            <text
              key={i}
              x={x}
              y={height - 4}
              textAnchor="middle"
              fontSize={8}
              fill={TEXT_COLOR}
              fontFamily="var(--mono)"
            >
              {truncateLabel(p.label, 8)}
            </text>
          )
        })}

        {/* Tooltip */}
        {hovered && hoveredIdx !== null && renderTooltip()}
      </svg>
    </div>
  )

  function barWidth(): number {
    return Math.max(Math.min(chartW / points.length - 2, 24), 4)
  }

  function barGap(): number {
    const bw = barWidth()
    return (chartW - bw * points.length) / Math.max(points.length - 1, 1)
  }

  function barX(i: number): number {
    return PADDING.left + i * (barWidth() + barGap())
  }

  function renderBars() {
    const bw = barWidth()
    return points.map((p, i) => {
      const h = Math.max(((p.value - Math.min(yMin, 0)) / (yMax - yMin)) * chartH, 1)
      const y = scaleY(p.value)
      return (
        <rect
          key={i}
          x={barX(i)}
          y={y}
          width={bw}
          height={h}
          rx={2}
          fill={hoveredIdx === i ? BAR_HOVER_COLOR : BAR_COLOR}
          opacity={hoveredIdx !== null && hoveredIdx !== i ? 0.4 : 0.85}
          onMouseEnter={() => setHoveredIdx(i)}
          style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
        />
      )
    })
  }

  function renderLine() {
    const pathD = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(p.value)}`)
      .join(' ')

    return (
      <g>
        {/* Area fill */}
        <path
          d={`${pathD} L ${scaleX(points.length - 1)} ${scaleY(0)} L ${scaleX(0)} ${scaleY(0)} Z`}
          fill={LINE_COLOR}
          opacity={0.08}
        />
        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke={LINE_COLOR}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Dots */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={scaleX(i)}
            cy={scaleY(p.value)}
            r={hoveredIdx === i ? 5 : 3}
            fill={hoveredIdx === i ? LINE_DOT_HOVER : LINE_DOT_COLOR}
            opacity={hoveredIdx !== null && hoveredIdx !== i ? 0.4 : 1}
            onMouseEnter={() => setHoveredIdx(i)}
            style={{ cursor: 'pointer', transition: 'r 0.15s, opacity 0.15s' }}
          />
        ))}
      </g>
    )
  }

  function renderTooltip() {
    if (hoveredIdx === null || !hovered) return null

    const x = type === 'bar'
      ? barX(hoveredIdx) + barWidth() / 2
      : scaleX(hoveredIdx)

    const tooltipW = 120
    const tooltipH = 32
    const tx = Math.min(Math.max(x - tooltipW / 2, 4), width - tooltipW - 4)
    const ty = Math.max(scaleY(hovered.value) - tooltipH - 8, 0)

    return (
      <g>
        <rect
          x={tx}
          y={ty}
          width={tooltipW}
          height={tooltipH}
          rx={6}
          fill="var(--bg2, #1a1f2e)"
          stroke="var(--border, #333)"
        />
        <text
          x={tx + 8}
          y={ty + 13}
          fontSize={10}
          fill="var(--accent)"
          fontFamily="var(--mono)"
          fontWeight={600}
        >
          {hovered.label}
        </text>
        <text
          x={tx + 8}
          y={ty + 25}
          fontSize={9}
          fill="var(--text2, #aaa)"
          fontFamily="var(--mono)"
        >
          {chart.yLabel}: {formatNumber(hovered.value)}
        </text>
      </g>
    )
  }
}

/** Compute nice Y-axis tick values */
function computeYTicks(range: number, targetTicks: number): number[] {
  const step = niceStep(range, targetTicks)
  const ticks: number[] = []
  for (let v = 0; v <= range + step * 0.1; v += step) {
    ticks.push(Math.round(v * 1e6) / 1e6)
  }
  return ticks
}

function niceStep(max: number, targetTicks: number): number {
  if (max === 0) return 1
  const rough = max / targetTicks
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)))
  const residual = rough / magnitude

  let nice: number
  if (residual <= 1.5) nice = 1
  else if (residual <= 3) nice = 2
  else if (residual <= 7) nice = 5
  else nice = 10

  return nice * magnitude
}

function formatTickValue(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`
  if (Number.isInteger(v)) return String(v)
  return v.toFixed(v >= 10 ? 1 : 2)
}

function formatNumber(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(2)}K`
  if (Number.isInteger(v)) return v.toLocaleString()
  return v.toFixed(2)
}

function truncateLabel(label: string, maxLen: number): string {
  if (label.length <= maxLen) return label
  return label.slice(0, maxLen - 1) + '…'
}
