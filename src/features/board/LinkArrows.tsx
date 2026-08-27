import { useLayoutEffect, useState } from 'react'
import type { RefObject } from 'react'

interface Line {
  key: string
  x1: number
  y1: number
  x2: number
  y2: number
}

interface Props {
  boardRef: RefObject<HTMLElement | null>
  hoveredId: string | null
  relatedIds: string[]
}

function edgePoint(
  rect: DOMRect,
  towardX: number,
  towardY: number,
  board: DOMRect,
) {
  const cx = rect.left + rect.width / 2 - board.left
  const cy = rect.top + rect.height / 2 - board.top
  const dx = towardX - cx
  const dy = towardY - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }

  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)
  const hw = rect.width / 2
  const hh = rect.height / 2

  if (absDx / hw > absDy / hh) {
    const sx = dx > 0 ? 1 : -1
    return { x: cx + sx * hw, y: cy + (dy / absDx) * hw }
  }
  const sy = dy > 0 ? 1 : -1
  return { x: cx + (dx / absDy) * hh, y: cy + sy * hh }
}

export function LinkArrows({ boardRef, hoveredId, relatedIds }: Props) {
  const [lines, setLines] = useState<Line[]>([])

  useLayoutEffect(() => {
    const board = boardRef.current
    if (!board || !hoveredId || relatedIds.length === 0) {
      setLines([])
      return
    }

    function measure() {
      if (!board) return
      const boardRect = board.getBoundingClientRect()
      const sources = [
        ...board.querySelectorAll<HTMLElement>(
          `[data-card-id="${CSS.escape(hoveredId!)}"]`,
        ),
      ]
      if (!sources.length) {
        setLines([])
        return
      }

      const next: Line[] = []
      for (const rid of relatedIds) {
        const targets = [
          ...board.querySelectorAll<HTMLElement>(
            `[data-card-id="${CSS.escape(rid)}"]`,
          ),
        ]
        let best: Line | null = null
        let bestDist = Infinity

        for (const s of sources) {
          const sr = s.getBoundingClientRect()
          const scx = sr.left + sr.width / 2 - boardRect.left
          const scy = sr.top + sr.height / 2 - boardRect.top

          for (const t of targets) {
            if (s === t) continue
            const tr = t.getBoundingClientRect()
            const tcx = tr.left + tr.width / 2 - boardRect.left
            const tcy = tr.top + tr.height / 2 - boardRect.top
            const dist = (scx - tcx) ** 2 + (scy - tcy) ** 2
            if (dist >= bestDist) continue

            const from = edgePoint(sr, tcx, tcy, boardRect)
            const to = edgePoint(tr, scx, scy, boardRect)
            bestDist = dist
            best = {
              key: `${hoveredId}-${rid}-${Math.round(from.x)}-${Math.round(to.x)}`,
              x1: from.x,
              y1: from.y,
              x2: to.x,
              y2: to.y,
            }
          }
        }
        if (best) next.push(best)
      }
      setLines(next)
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(board)
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [boardRef, hoveredId, relatedIds])

  if (!lines.length) return null

  return (
    <svg className="link-arrows" aria-hidden>
      <defs>
        <marker
          id="link-arrow-head"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" className="link-arrows__head" />
        </marker>
      </defs>
      {lines.map((line) => (
        <line
          key={line.key}
          className="link-arrows__line"
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          markerEnd="url(#link-arrow-head)"
        />
      ))}
    </svg>
  )
}
