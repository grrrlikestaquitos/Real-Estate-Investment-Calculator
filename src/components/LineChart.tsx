import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { niceTicks } from '../lib/chart'
import { formatCurrency, formatCurrencyCompact } from '../lib/format'

export interface ChartSeries {
  label: string
  values: readonly (number | null)[]
}

interface LineChartProps {
  /** Accessible name, e.g. "Home value and equity over the next 30 years". */
  title: string
  /** X positions in years, one per value in each series. */
  years: readonly number[]
  /** Up to three series; colors follow their order (series slots 1–3). */
  series: readonly ChartSeries[]
  /** Shown instead of the chart while no series has data. */
  emptyMessage: string
}

const HEIGHT = 240
const MARGIN = { top: 14, right: 60, bottom: 30, left: 56 }
/** End labels closer than this (px) would collide, so the legend + tooltip carry them instead. */
const END_LABEL_MIN_GAP = 16

function yearLabel(year: number): string {
  return year === 0 ? 'Today' : `Year ${year}`
}

function tickLabel(year: number): string {
  return year === 0 ? 'Now' : `${year} yr`
}

function lastIndexWithValue(values: readonly (number | null)[]): number {
  for (let i = values.length - 1; i >= 0; i--) if (values[i] != null) return i
  return -1
}

/** SVG path through the points, lifting the pen over gaps. */
function linePath(points: ([number, number] | null)[]): string {
  let d = ''
  let penDown = false
  for (const point of points) {
    if (!point) {
      penDown = false
      continue
    }
    d += `${penDown ? 'L' : 'M'}${point[0].toFixed(1)},${point[1].toFixed(1)}`
    penDown = true
  }
  return d
}

function useElementWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

export function LineChart({ title, years, series, emptyMessage }: LineChartProps) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>(640)
  const [active, setActive] = useState<number | null>(null)
  const [fromKeyboard, setFromKeyboard] = useState(false)

  const visible = series
    .map((s, i) => ({ ...s, slot: i + 1 }))
    .filter((s) => s.values.some((v) => v != null))

  // The wrapper stays mounted while empty so its width is already measured when data arrives.
  if (visible.length === 0 || years.length < 2) {
    return (
      <div className="chart" ref={wrapRef}>
        <p className="chart-empty">{emptyMessage}</p>
      </div>
    )
  }

  const numbers = visible.flatMap((s) => s.values.filter((v): v is number => v != null))
  const ticks = niceTicks(Math.min(0, ...numbers), Math.max(0, ...numbers))
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]
  const plotWidth = Math.max(120, width - MARGIN.left - MARGIN.right)
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom
  const firstYear = years[0]
  const lastYear = years[years.length - 1]
  const xOf = (year: number) => MARGIN.left + ((year - firstYear) / (lastYear - firstYear)) * plotWidth
  const yOf = (value: number) => MARGIN.top + (1 - (value - yMin) / (yMax - yMin)) * plotHeight

  const xTickStep = plotWidth < 360 ? 10 : 5
  const xTicks = years.filter((year) => (year - firstYear) % xTickStep === 0)

  const ends = visible.map((s) => {
    const index = lastIndexWithValue(s.values)
    return { slot: s.slot, index, value: s.values[index] as number }
  })
  const endLabelsFit = ends.every((a) =>
    ends.every((b) => a === b || Math.abs(yOf(a.value) - yOf(b.value)) >= END_LABEL_MIN_GAP),
  )

  const lastIndex = years.length - 1

  function nearestIndex(event: PointerEvent<SVGSVGElement>): number {
    const px = event.clientX - event.currentTarget.getBoundingClientRect().left
    const year = firstYear + ((px - MARGIN.left) / plotWidth) * (lastYear - firstYear)
    const clamped = Math.min(lastYear, Math.max(firstYear, year))
    return years.reduce((best, y, i) => (Math.abs(y - clamped) < Math.abs(years[best] - clamped) ? i : best), 0)
  }

  function handlePointer(event: PointerEvent<SVGSVGElement>) {
    setFromKeyboard(false)
    setActive(nearestIndex(event))
  }

  function handleKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    const current = active ?? lastIndex
    const moves: Record<string, number> = {
      ArrowLeft: current - 1,
      ArrowRight: current + 1,
      PageDown: current - 5,
      PageUp: current + 5,
      Home: 0,
      End: lastIndex,
    }
    if (!(event.key in moves)) return
    event.preventDefault()
    setFromKeyboard(true)
    setActive(Math.min(lastIndex, Math.max(0, moves[event.key])))
  }

  const readout =
    active == null
      ? ''
      : `${yearLabel(years[active])}: ${visible
          .map((s) => `${s.label} ${formatCurrency(s.values[active])}`)
          .join(', ')}`

  const activeX = active == null ? 0 : xOf(years[active])
  const tooltipOnLeft = activeX > width - 200

  return (
    <div className="chart" ref={wrapRef}>
      {visible.length > 1 ? (
        <ul className="chart-legend">
          {visible.map((s) => (
            <li key={s.slot}>
              <span className={`line-key line-key-${s.slot}`} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="chart-plot">
        <svg
          className="chart-svg"
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`${title}. Focus and use the arrow keys to read values by year.`}
          tabIndex={0}
          onPointerMove={handlePointer}
          onPointerDown={handlePointer}
          onPointerLeave={() => !fromKeyboard && setActive(null)}
          onKeyDown={handleKeyDown}
          onFocus={(event) => {
            // A click also focuses the chart; only keyboard focus starts the readout.
            let keyboardFocus = true
            try {
              keyboardFocus = event.currentTarget.matches(':focus-visible')
            } catch {
              // Older engines without :focus-visible: treat as keyboard focus.
            }
            if (!keyboardFocus) return
            setFromKeyboard(true)
            setActive((current) => current ?? lastIndex)
          }}
          onBlur={() => {
            setFromKeyboard(false)
            setActive(null)
          }}
        >
          <g className="chart-grid">
            {ticks.map((tick) => (
              <line
                key={tick}
                x1={MARGIN.left}
                x2={MARGIN.left + plotWidth}
                y1={yOf(tick)}
                y2={yOf(tick)}
                className={tick === 0 ? 'chart-baseline' : undefined}
              />
            ))}
          </g>

          <g className="chart-axis-labels">
            {ticks.map((tick) => (
              <text key={tick} x={MARGIN.left - 8} y={yOf(tick)} dy="0.32em" textAnchor="end">
                {formatCurrencyCompact(tick)}
              </text>
            ))}
            {xTicks.map((year) => (
              <text
                key={year}
                x={xOf(year)}
                y={HEIGHT - 8}
                textAnchor={year === firstYear ? 'start' : year === lastYear ? 'end' : 'middle'}
              >
                {tickLabel(year)}
              </text>
            ))}
          </g>

          {active != null ? (
            <line
              className="chart-crosshair"
              x1={activeX}
              x2={activeX}
              y1={MARGIN.top}
              y2={MARGIN.top + plotHeight}
            />
          ) : null}

          {visible.map((s) => (
            <path
              key={s.slot}
              className={`chart-line series-${s.slot}`}
              d={linePath(
                s.values.map((v, i) => (v == null ? null : [xOf(years[i]), yOf(v)] as [number, number])),
              )}
            />
          ))}

          {ends.map((end) => (
            <g key={end.slot}>
              <circle
                className={`chart-dot series-${end.slot}`}
                cx={xOf(years[end.index])}
                cy={yOf(end.value)}
                r={4}
              />
              {endLabelsFit ? (
                <text
                  className="chart-end-label"
                  x={xOf(years[end.index]) + 9}
                  y={yOf(end.value)}
                  dy="0.32em"
                >
                  {formatCurrencyCompact(end.value)}
                </text>
              ) : null}
            </g>
          ))}

          {active != null
            ? visible.map((s) => {
                const value = s.values[active]
                return value == null ? null : (
                  <circle
                    key={s.slot}
                    className={`chart-dot series-${s.slot}`}
                    cx={activeX}
                    cy={yOf(value)}
                    r={4.5}
                  />
                )
              })
            : null}
        </svg>

        {active != null ? (
          <div
            className={`chart-tooltip ${tooltipOnLeft ? 'chart-tooltip-left' : ''}`}
            style={{ left: activeX, top: MARGIN.top }}
            aria-hidden="true"
          >
            <div className="chart-tooltip-title">{yearLabel(years[active])}</div>
            {visible.map((s) => (
              <div key={s.slot} className="chart-tooltip-row">
                <span className={`line-key line-key-${s.slot}`} />
                <strong>{formatCurrency(s.values[active])}</strong>
                <span className="chart-tooltip-label">{s.label}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <p className="sr-only" aria-live="polite">
        {fromKeyboard ? readout : ''}
      </p>
    </div>
  )
}
