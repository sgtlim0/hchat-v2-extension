// components/UsageChart.tsx — Pure SVG daily cost chart

import { useState } from 'react'
import { formatCost } from '../lib/usage'

interface DataPoint {
  date: string
  cost: number
  requests: number
}

interface Props {
  data: DataPoint[]
  width?: number
  height?: number
}

const PADDING = { top: 20, right: 12, bottom: 28, left: 44 }
const BAR_COLOR = '#34d399'
const BAR_HOVER_COLOR = '#10b981'
const GRID_COLOR = 'rgba(255,255,255,0.06)'
const TEXT_COLOR = 'var(--text3)'
const ACCENT_COLOR = 'var(--accent)'

export function UsageChart({ data, width = 320, height = 160 }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  if (data.length === 0) return null

  const chartW = width - PADDING.left - PADDING.right
  const chartH = height - PADDING.top - PADDING.bottom
  const maxCost = Math.max(...data.map((d) => d.cost), 0.001)
  const barWidth = Math.max(Math.min(chartW / data.length - 2, 20), 4)
  const barGap = (chartW - barWidth * data.length) / Math.max(data.length - 1, 1)

  // Y-axis ticks (3-4 ticks)
  const yTicks: number[] = []
  const step = niceStep(maxCost, 4)
  for (let v = 0; v <= maxCost + step * 0.1; v += step) {
    yTicks.push(v)
  }
  const yMax = yTicks[yTicks.length - 1] || maxCost

  function barX(i: number): number {
    return PADDING.left + i * (barWidth + barGap)
  }

  function barH(cost: number): number {
    return (cost / yMax) * chartH
  }

  function barY(cost: number): number {
    return PADDING.top + chartH - barH(cost)
  }

  const hovered = hoveredIdx !== null ? data[hoveredIdx] : null

  return (
    <svg
      width={width}
      height={height}
      style={{ display: 'block', overflow: 'visible' }}
      onMouseLeave={() => setHoveredIdx(null)}
    >
      {/* Grid lines */}
      {yTicks.map((v) => (
        <g key={v}>
          <line
            x1={PADDING.left}
            y1={barY(v)}
            x2={width - PADDING.right}
            y2={barY(v)}
            stroke={GRID_COLOR}
            strokeDasharray="3,3"
          />
          <text
            x={PADDING.left - 4}
            y={barY(v) + 3}
            textAnchor="end"
            fontSize={9}
            fill={TEXT_COLOR}
            fontFamily="var(--mono)"
          >
            ${v.toFixed(v >= 1 ? 1 : 2)}
          </text>
        </g>
      ))}

      {/* Bars */}
      {data.map((d, i) => (
        <g key={d.date}>
          <rect
            x={barX(i)}
            y={barY(d.cost)}
            width={barWidth}
            height={Math.max(barH(d.cost), 1)}
            rx={2}
            fill={hoveredIdx === i ? BAR_HOVER_COLOR : BAR_COLOR}
            opacity={hoveredIdx !== null && hoveredIdx !== i ? 0.4 : 0.85}
            onMouseEnter={() => setHoveredIdx(i)}
            style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
          />
          {/* X-axis labels (show every other for readability) */}
          {(data.length <= 14 || i % 2 === 0) && (
            <text
              x={barX(i) + barWidth / 2}
              y={height - 4}
              textAnchor="middle"
              fontSize={8}
              fill={TEXT_COLOR}
              fontFamily="var(--mono)"
            >
              {d.date.slice(5)}
            </text>
          )}
        </g>
      ))}

      {/* Tooltip */}
      {hovered && hoveredIdx !== null && (
        <g>
          <rect
            x={Math.min(barX(hoveredIdx) - 30, width - 110)}
            y={Math.max(barY(hovered.cost) - 40, 0)}
            width={100}
            height={32}
            rx={6}
            fill="var(--bg2, #1a1f2e)"
            stroke="var(--border, #333)"
          />
          <text
            x={Math.min(barX(hoveredIdx) - 30, width - 110) + 8}
            y={Math.max(barY(hovered.cost) - 40, 0) + 14}
            fontSize={10}
            fill={ACCENT_COLOR}
            fontFamily="var(--mono)"
            fontWeight={600}
          >
            {hovered.date}
          </text>
          <text
            x={Math.min(barX(hoveredIdx) - 30, width - 110) + 8}
            y={Math.max(barY(hovered.cost) - 40, 0) + 26}
            fontSize={9}
            fill="var(--text2, #aaa)"
            fontFamily="var(--mono)"
          >
            {formatCost(hovered.cost)} · {hovered.requests} req
          </text>
        </g>
      )}
    </svg>
  )
}

/** Calculate a "nice" step value for axis ticks */
function niceStep(max: number, targetTicks: number): number {
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
