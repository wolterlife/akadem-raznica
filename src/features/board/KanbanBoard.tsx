import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { COLUMNS } from '../../data'
import { getMatchKind, getRelatedLinks } from '../../sync'
import type { Assessment, ColumnId } from '../../types'
import type { PresenceUser } from '../../presence'
import { Card } from './Card'
import { Column } from './Column'
import {
  itemsByColumn,
  orderedColumnItems,
  type SortKey,
} from './filters'

interface Props {
  items: Assessment[]
  visible: Assessment[]
  sortKey: SortKey
  hoveredId: string | null
  onHoverChange: (id: string | null, col?: string | null) => void
  editorsByCard: Map<string, PresenceUser[]>
  onEdit: (item: Assessment) => void
  onMove: (id: string, column: ColumnId) => void
}

function parseCardId(dragId: string) {
  const sep = dragId.indexOf('::')
  return sep >= 0 ? dragId.slice(0, sep) : dragId
}

export function KanbanBoard({
  items,
  visible,
  sortKey,
  hoveredId,
  onHoverChange,
  editorsByCard,
  onEdit,
  onMove,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const activeItem = useMemo(() => {
    if (!activeId) return null
    return items.find((i) => i.id === parseCardId(activeId)) ?? null
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

  function linkStateFor(id: string): 'idle' | 'focus' | 'related' | 'dim' {
    if (!relatedLinks) return 'idle'
    if (id === hoveredId) return 'focus'
    if (relatedLinks.has(id)) return 'related'
    return 'dim'
  }

  function renderCard(item: Assessment, colId: ColumnId) {
    const both = item.owners.includes('D') && item.owners.includes('M')
    const dragId = both && colId !== 'done' ? `${item.id}::${colId}` : item.id
    return (
      <Card
        key={dragId}
        dragId={dragId}
        colId={colId}
        item={item}
        allItems={items}
        match={item.column === 'done' ? 'none' : getMatchKind(item, items)}
        editors={editorsByCard.get(item.id)}
        linkState={linkStateFor(item.id)}
        onHoverChange={onHoverChange}
        onEdit={onEdit}
      />
    )
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const overId = String(over.id)
    const columnIds = COLUMNS.map((c) => c.id)
    let targetColumn: ColumnId | null = null

    if (columnIds.includes(overId as ColumnId)) {
      targetColumn = overId as ColumnId
    } else {
      const overCard = items.find((i) => i.id === parseCardId(overId))
      if (overCard) {
        const sep = overId.indexOf('::')
        if (sep >= 0) {
          const col = overId.slice(sep + 2) as ColumnId
          if (columnIds.includes(col)) targetColumn = col
          else targetColumn = overCard.column
        } else {
          targetColumn = overCard.column
        }
      }
    }

    if (!targetColumn) return
    onMove(parseCardId(String(active.id)), targetColumn)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
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
