import { useState, type PointerEvent } from 'react'
import {
  addDays,
  diffDays,
  formatDay,
  idealLeft,
  type PersonPace,
} from './pace'

interface Props {
  person: PersonPace
  total: number
  left: number
  today: string
}

const W = 520
const H = 220
const PAD = { l: 42, r: 14, t: 16, b: 32 }

interface Hover {
  date: string
  x: number
  idealRemain: number
  shouldBeDone: number
  actualRemain: number | null
}

function niceMax(value: number) {
  const n = Math.max(1, value)
  if (n <= 4) return 4
  if (n <= 8) return 8
  const step = n <= 20 ? 4 : n <= 40 ? 5 : 10
  return Math.ceil(n / step) * step
}

function yTicks(max: number) {
  const step = max <= 8 ? 2 : max <= 20 ? 4 : max <= 40 ? 5 : 10
  const ticks: number[] = []
  for (let v = 0; v <= max; v += step) ticks.push(v)
  if (ticks[ticks.length - 1] !== max) ticks.push(max)
  return ticks
}

function xTicks(start: string, due: string) {
  const span = Math.max(0, diffDays(start, due))
  if (span <= 0) return [start, due].filter((v, i, arr) => arr.indexOf(v) === i)
  const count = span <= 2 ? span + 1 : Math.min(5, span + 1)
  const seen = new Set<string>()
  const keys: string[] = []
  for (let i = 0; i < count; i++) {
    const key = addDays(start, Math.round((i / Math.max(1, count - 1)) * span))
    if (seen.has(key)) continue
    seen.add(key)
    keys.push(key)
  }
  if (!seen.has(due)) keys.push(due)
  return keys
}

function svgX(svg: SVGSVGElement, clientX: number) {
  const rect = svg.getBoundingClientRect()
  if (!rect.width) return PAD.l
  return ((clientX - rect.left) / rect.width) * W
}

export function BurndownChart({ person, total, left, today }: Props) {
  const start = person.startedAt
  const due = person.due
  const rawSpan = Math.max(0, diffDays(start, due))
  const innerW = W - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b
  const begun = diffDays(start, today) >= 0
  const [hover, setHover] = useState<Hover | null>(null)

  const samples = Object.entries(person.samples)
    .map(([date, remaining]) => ({ date, remaining }))
    .filter((s) => diffDays(start, s.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))

  if (begun && !samples.some((s) => s.date === today)) {
    samples.push({ date: today, remaining: left })
    samples.sort((a, b) => a.date.localeCompare(b.date))
  }

  const maxY = niceMax(
    Math.max(total, left, ...samples.map((s) => s.remaining), 1),
  )

  function xAt(date: string) {
    if (rawSpan <= 0) {
      return diffDays(start, date) > 0 ? PAD.l + innerW : PAD.l
    }
    const t = Math.min(rawSpan, Math.max(0, diffDays(start, date)))
    return PAD.l + (t / rawSpan) * innerW
  }

  function yAt(remaining: number) {
    return PAD.t + (1 - remaining / maxY) * innerH
  }

  function dateAtX(x: number) {
    if (rawSpan <= 0) return start
    const t = (x - PAD.l) / innerW
    const day = Math.round(Math.min(rawSpan, Math.max(0, t * rawSpan)))
    return addDays(start, day)
  }

  const ideal = [
    `${xAt(start).toFixed(1)},${yAt(total).toFixed(1)}`,
    `${xAt(due).toFixed(1)},${yAt(0).toFixed(1)}`,
  ].join(' ')

  const actualPts = samples.filter((s) => diffDays(s.date, today) >= 0)
  const actualLine = actualPts
    .map((s) => `${xAt(s.date).toFixed(1)},${yAt(s.remaining).toFixed(1)}`)
    .join(' ')

  const area = actualPts.length
    ? [
        `${xAt(actualPts[0]!.date).toFixed(1)},${yAt(0).toFixed(1)}`,
        ...actualPts.map(
          (s) => `${xAt(s.date).toFixed(1)},${yAt(s.remaining).toFixed(1)}`,
        ),
        `${xAt(actualPts[actualPts.length - 1]!.date).toFixed(1)},${yAt(0).toFixed(1)}`,
      ].join(' ')
    : ''

  const todayX = xAt(today)
  const showToday = begun && diffDays(today, due) >= 0

  function onMove(e: PointerEvent<SVGSVGElement>) {
    const x = svgX(e.currentTarget, e.clientX)
    const date = dateAtX(x)
    const remain = idealLeft(total, start, due, date)
    const actual = actualPts.find((s) => s.date === date)?.remaining ?? null
    setHover({
      date,
      x: xAt(date),
      idealRemain: remain,
      shouldBeDone: Math.round(total - remain),
      actualRemain: actual,
    })
  }

  const tipLeft = hover
    ? Math.min(86, Math.max(14, ((hover.x - PAD.l) / innerW) * 100))
    : 50

  return (
    <div className="burn__chart">
      <svg
        className="burn__svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="График burndown. Наведи, чтобы увидеть план на день."
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {yTicks(maxY).map((v) => (
          <g key={v}>
            <line
              className="burn__grid"
              x1={PAD.l}
              x2={W - PAD.r}
              y1={yAt(v)}
              y2={yAt(v)}
            />
            <text className="burn__tick" x={PAD.l - 8} y={yAt(v) + 3} textAnchor="end">
              {v}
            </text>
          </g>
        ))}

        {xTicks(start, due).map((key) => (
          <text
            key={key}
            className="burn__tick"
            x={xAt(key)}
            y={H - 10}
            textAnchor="middle"
          >
            {formatDay(key)}
          </text>
        ))}

        {area ? <polygon className="burn__fill" points={area} /> : null}
        <polyline className="burn__ideal" points={ideal} />
        {actualLine ? <polyline className="burn__now" points={actualLine} /> : null}

        {actualPts.map((s) => (
          <circle
            key={s.date}
            className="burn__dot"
            cx={xAt(s.date)}
            cy={yAt(s.remaining)}
            r={s.date === today ? 4 : 3}
          />
        ))}

        {showToday ? (
          <line
            className="burn__today"
            x1={todayX}
            x2={todayX}
            y1={PAD.t}
            y2={H - PAD.b}
          />
        ) : null}

        {hover ? (
          <g className="burn__cursor">
            <line
              x1={hover.x}
              x2={hover.x}
              y1={PAD.t}
              y2={H - PAD.b}
            />
            <circle cx={hover.x} cy={yAt(hover.idealRemain)} r={4.5} />
          </g>
        ) : null}

        <rect
          x={PAD.l}
          y={PAD.t}
          width={innerW}
          height={innerH}
          fill="transparent"
        />
      </svg>

      {hover ? (
        <div
          className={`burn__tip ${tipLeft > 62 ? 'burn__tip--left' : ''}`}
          style={{ left: `${tipLeft}%` }}
        >
          <strong>{formatDay(hover.date)}</strong>
          <p>должно остаться {Math.round(hover.idealRemain)}</p>
          <p>должно быть сдано {hover.shouldBeDone} из {total}</p>
          {hover.actualRemain != null ? (
            <p>факт: осталось {hover.actualRemain}</p>
          ) : null}
        </div>
      ) : null}
      <p className="burn__hint" style={{ visibility: hover ? 'hidden' : 'visible' }}>
        наведи на график — точное число на день
      </p>
    </div>
  )
}
