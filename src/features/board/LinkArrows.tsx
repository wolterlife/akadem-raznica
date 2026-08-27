import { useLayoutEffect, useState } from 'react'
import type { RefObject } from 'react'
import type { LinkReason } from '../../sync'

interface Line {
  key: string
  x1: number
  y1: number
  x2: number
  y2: number
}

interface Hub {
  key: string
  x: number
  y: number
  label: string
}

interface Props {
  boardRef: RefObject<HTMLElement | null>
  hoveredId: string | null
  hoveredCol: string | null
  /** relatedId → reasons */
  related: Map<string, LinkReason[]>
}

type ClusterKind = 'subject' | 'professor' | 'shared'

function clusterOf(reasons: LinkReason[]): ClusterKind {
  if (reasons.includes('subject') || reasons.includes('shared')) return 'subject'
  return 'professor'
}

function clusterLabel(kind: ClusterKind, count: number) {
  if (kind === 'subject') {
    return count > 1 ? `предмет · ${count}` : 'предмет'
  }
  return count > 1 ? `препод · ${count}` : 'препод'
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
  const hw = rect.width / 2 - 2
  const hh = rect.height / 2 - 2

  if (absDx / hw > absDy / hh) {
    const sx = dx > 0 ? 1 : -1
    return { x: cx + sx * hw, y: cy + (dy / absDx) * hw }
  }
  const sy = dy > 0 ? 1 : -1
  return { x: cx + (dx / absDy) * hh, y: cy + sy * hh }
}

function arrowHead(x1: number, y1: number, x2: number, y2: number) {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const size = 8
  const left = {
    x: x2 - size * Math.cos(angle - Math.PI / 6),
    y: y2 - size * Math.sin(angle - Math.PI / 6),
  }
  const right = {
    x: x2 - size * Math.cos(angle + Math.PI / 6),
    y: y2 - size * Math.sin(angle + Math.PI / 6),
  }
  return `M ${x2} ${y2} L ${left.x} ${left.y} L ${right.x} ${right.y} Z`
}

function centerOf(el: HTMLElement, board: DOMRect) {
  const r = el.getBoundingClientRect()
  return {
    x: r.left + r.width / 2 - board.left,
    y: r.top + r.height / 2 - board.top,
    rect: r,
  }
}

export function LinkArrows({
  boardRef,
  hoveredId,
  hoveredCol,
  related,
}: Props) {
  const [lines, setLines] = useState<Line[]>([])
  const [hubs, setHubs] = useState<Hub[]>([])

  useLayoutEffect(() => {
    const board = boardRef.current
    if (!board || !hoveredId || related.size === 0) {
      setLines([])
      setHubs([])
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
      const source =
        (hoveredCol
          ? sources.find((el) => el.dataset.col === hoveredCol)
          : null) ?? sources[0]
      if (!source) {
        setLines([])
        setHubs([])
        return
      }

      const sourceCol = source.dataset.col ?? hoveredCol ?? 'd'
      const targetCol = sourceCol === 'd' ? 'm' : sourceCol === 'm' ? 'd' : null
      const src = centerOf(source, boardRect)

      const clusters = new Map<ClusterKind, HTMLElement[]>()
      for (const [rid, reasons] of related) {
        if (rid === hoveredId) continue
        const kind = clusterOf(reasons)
        const nodes = [
          ...board.querySelectorAll<HTMLElement>(
            `[data-card-id="${CSS.escape(rid)}"]`,
          ),
        ]
        // prefer other column; fall back to any other node
        let pick =
          (targetCol
            ? nodes.find((n) => n.dataset.col === targetCol)
            : null) ?? nodes.find((n) => n !== source)
        if (!pick) continue
        const list = clusters.get(kind) ?? []
        list.push(pick)
        clusters.set(kind, list)
      }

      if (clusters.size === 0) {
        setLines([])
        setHubs([])
        return
      }

      const dCol = board.querySelector<HTMLElement>('.column--d')
      const mCol = board.querySelector<HTMLElement>('.column--m')
      let gutterX = boardRect.width / 2
      if (dCol && mCol) {
        const dr = dCol.getBoundingClientRect()
        const mr = mCol.getBoundingClientRect()
        gutterX = (dr.right + mr.left) / 2 - boardRect.left
      }

      const nextLines: Line[] = []
      const nextHubs: Hub[] = []
      let hubIndex = 0

      for (const kind of ['subject', 'professor'] as ClusterKind[]) {
        const targets = clusters.get(kind)
        if (!targets?.length) continue

        const ys = targets.map((t) => centerOf(t, boardRect).y)
        const hubY =
          targets.length === 1
            ? ys[0]
            : (Math.min(...ys) + Math.max(...ys)) / 2
        const yOffset = clusters.size > 1 && kind === 'professor' ? 22 : 0
        const hx = gutterX
        const hy = hubY + yOffset
        hubIndex += 1

        const label = clusterLabel(kind, targets.length)
        nextHubs.push({ key: kind, x: hx, y: hy, label })

        const from = edgePoint(src.rect, hx, hy, boardRect)
        nextLines.push({
          key: `src-${kind}`,
          x1: from.x,
          y1: from.y,
          x2: hx,
          y2: hy,
        })

        for (let i = 0; i < targets.length; i++) {
          const t = targets[i]
          const tc = centerOf(t, boardRect)
          const to = edgePoint(tc.rect, hx, hy, boardRect)
          nextLines.push({
            key: `hub-${kind}-${i}`,
            x1: hx,
            y1: hy,
            x2: to.x,
            y2: to.y,
          })
        }
      }

      setLines(nextLines)
      setHubs(nextHubs)
    }

    const raf = window.requestAnimationFrame(measure)
    const ro = new ResizeObserver(measure)
    ro.observe(board)
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      window.cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [boardRef, hoveredId, hoveredCol, related])

  if (!lines.length && !hubs.length) return null

  return (
    <svg className="link-arrows" aria-hidden>
      {lines.map((line) => (
        <g key={line.key}>
          <line
            className="link-arrows__line"
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
          />
          <path
            className="link-arrows__head"
            d={arrowHead(line.x1, line.y1, line.x2, line.y2)}
          />
        </g>
      ))}
      {hubs.map((hub) => (
        <g key={hub.key} className="link-arrows__hub">
          <rect
            x={hub.x - 46}
            y={hub.y - 12}
            width={92}
            height={24}
            rx={8}
            className="link-arrows__hub-bg"
          />
          <text
            x={hub.x}
            y={hub.y + 4}
            textAnchor="middle"
            className="link-arrows__hub-text"
          >
            {hub.label}
          </text>
        </g>
      ))}
    </svg>
  )
}
