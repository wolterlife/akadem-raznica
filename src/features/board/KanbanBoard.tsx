import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { COLUMNS } from '../../data'
import { getMatchKind, getRelatedLinks, type LinkReason } from '../../sync'
import type { Assessment, ColumnId } from '../../types'
import type { PresenceUser } from '../../presence'
import { Card } from './Card'
import { Column } from './Column'
import {
  itemsByColumn,
  orderedColumnItems,
  type SortKey,
} from './filters'
import { isFullyDone, visibleColumnsOf } from './progress'

interface Props {
  items: Assessment[]
  visible: Assessment[]
  sortKey: SortKey
  hoveredId: string | null
  hoveredCol: string | null
  onHoverChange: (id: string | null, col?: string | null) => void
  editorsByCard: Map<string, PresenceUser[]>
  onEdit: (item: Assessment) => void
  onMove: (id: string, column: ColumnId, fromColumn?: ColumnId) => void
}

const COLUMN_IDS: ColumnId[] = ['d', 'm', 'done']
const COMPACT_MQ = '(max-width: 720px), (pointer: coarse)'

/** Prefer the column under the pointer so Done isn't stolen by a card in M. */
const columnFirstCollision: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  const done = hits.find((hit) => String(hit.id) === 'done')
  if (done) return [done]
  const column = hits.find((hit) =>
    COLUMN_IDS.includes(String(hit.id) as ColumnId),
  )
  if (column) return [column]
  if (hits.length) return hits
  return closestCorners(args)
}

function parseDrag(dragId: string): { id: string; col?: ColumnId } {
  const sep = dragId.indexOf('::')
  if (sep < 0) return { id: dragId }
  return {
    id: dragId.slice(0, sep),
    col: dragId.slice(sep + 2) as ColumnId,
  }
}

function useCompactBoard() {
  const [compact, setCompact] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(COMPACT_MQ).matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia(COMPACT_MQ)
    const onChange = () => setCompact(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return compact
}

function columnTitle(id: ColumnId) {
  return COLUMNS.find((c) => c.id === id)?.title ?? id.toUpperCase()
}

function reasonLabel(reasons: LinkReason[]): string {
  const hasSub = reasons.includes('subject')
  const hasProf = reasons.includes('professor')
  if (hasSub && hasProf) return 'предмет и препод'
  if (hasSub) return 'тот же предмет'
  if (hasProf) return 'тот же преподаватель'
  return 'связь'
}

function jumpToCard(id: string, preferCol?: string) {
  const nodes = [
    ...document.querySelectorAll<HTMLElement>(`[data-card-id="${id}"]`),
  ]
  const el =
    (preferCol && nodes.find((n) => n.dataset.col === preferCol)) || nodes[0]
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

export function KanbanBoard({
  items,
  visible,
  sortKey,
  hoveredId,
  hoveredCol,
  onHoverChange,
  editorsByCard,
  onEdit,
  onMove,
}: Props) {
  const compact = useCompactBoard()
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
  )

  const activeItem = useMemo(() => {
    if (!activeId) return null
    return items.find((i) => i.id === parseDrag(activeId).id) ?? null
  }, [items, activeId])

  const relatedLinks = useMemo(() => {
    if (!hoveredId) return null
    const card = items.find((i) => i.id === hoveredId)
    if (!card) return null
    return getRelatedLinks(card, items)
  }, [hoveredId, items])

  const columnItems = useMemo(() => {
    return {
      d: orderedColumnItems(visible, items, sortKey, 'd'),
      m: orderedColumnItems(visible, items, sortKey, 'm'),
      done: itemsByColumn(visible, 'done'),
    }
  }, [visible, items, sortKey])

  const relatedCards = useMemo(() => {
    if (!hoveredId || !relatedLinks) return []
    const shown = new Set(
      [...columnItems.d, ...columnItems.m, ...columnItems.done].map((i) => i.id),
    )
    return items
      .filter(
        (item) =>
          item.id !== hoveredId &&
          relatedLinks.has(item.id) &&
          shown.has(item.id),
      )
      .map((item) => ({
        item,
        reasons: relatedLinks.get(item.id) ?? [],
        cols: visibleColumnsOf(item),
      }))
  }, [hoveredId, items, relatedLinks, columnItems])

  function linkStateFor(id: string): 'idle' | 'focus' | 'related' | 'dim' {
    if (!relatedLinks) return 'idle'
    if (id === hoveredId) return 'focus'
    if (relatedLinks.has(id)) return 'related'
    return 'dim'
  }

  function renderCard(item: Assessment, colId: ColumnId) {
    const dragId = `${item.id}::${colId}`
    return (
      <Card
        key={dragId}
        dragId={dragId}
        colId={colId}
        item={item}
        allItems={items}
        match={isFullyDone(item) ? 'none' : getMatchKind(item, items)}
        editors={editorsByCard.get(item.id)}
        linkState={linkStateFor(item.id)}
        onHoverChange={onHoverChange}
        onEdit={onEdit}
        compact={compact}
        onMove={onMove}
      />
    )
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function onDragEnd(event: DragEndEvent) {
    const from = activeId ? parseDrag(activeId).col : undefined
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const overId = String(over.id)
    const columnIds = COLUMN_IDS
    let targetColumn: ColumnId | null = null

    if (columnIds.includes(overId as ColumnId)) {
      targetColumn = overId as ColumnId
    } else {
      const parsed = parseDrag(overId)
      const overCard = items.find((i) => i.id === parsed.id)
      if (overCard) {
        if (parsed.col && columnIds.includes(parsed.col)) targetColumn = parsed.col
        else targetColumn = overCard.column
      }
    }

    if (!targetColumn) return
    const dragged = parseDrag(String(active.id))
    onMove(dragged.id, targetColumn, dragged.col ?? from)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={columnFirstCollision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      autoScroll={{ threshold: { x: 0.12, y: 0.18 } }}
    >
      <nav className="board-jump" aria-label="Перейти к колонке">
        {COLUMNS.map((col) => (
          <a key={col.id} href={`#col-${col.id}`}>
            {col.title}
            <span>{columnItems[col.id].length}</span>
          </a>
        ))}
      </nav>

      <div className="board">
        {COLUMNS.map((col) => {
          const colItems = columnItems[col.id]
          return (
            <Column
              key={col.id}
              id={col.id}
              title={col.title}
              subtitle={col.subtitle}
              count={colItems.length}
            >
              {colItems.map((item) => renderCard(item, col.id))}
            </Column>
          )
        })}
      </div>

      {compact && hoveredId ? (
        <div className="board-links" role="status">
          <div className="board-links__head">
            <p>Связи</p>
            <button
              type="button"
              className="board-links__clear"
              onClick={() => onHoverChange(null)}
            >
              сбросить
            </button>
          </div>
          {relatedCards.length === 0 ? (
            <p className="board-links__empty">Нет связанных карточек</p>
          ) : (
            <ul className="board-links__list">
              {hoveredId ? (
                <li>
                  <button
                    type="button"
                    onClick={() => jumpToCard(hoveredId, hoveredCol ?? undefined)}
                  >
                    <span className="board-links__name">
                      {items.find((i) => i.id === hoveredId)?.short}
                      {hoveredCol
                        ? ` · ${columnTitle(hoveredCol as ColumnId)}`
                        : ''}
                    </span>
                    <span className="board-links__why">выбранная</span>
                  </button>
                </li>
              ) : null}
              {relatedCards.map(({ item, reasons, cols }) => {
                const prefer =
                  cols.find((c) => c !== hoveredCol) ?? cols[0]
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => jumpToCard(item.id, prefer)}
                    >
                      <span className="board-links__name">
                        {item.short}
                        {cols.length
                          ? ` · ${cols.map(columnTitle).join('/')}`
                          : ''}
                      </span>
                      <span className="board-links__why">{reasonLabel(reasons)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}

      <DragOverlay>
        {activeItem ? (
          <Card
            item={activeItem}
            allItems={items}
            match={getMatchKind(activeItem, items)}
            onEdit={() => {}}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
