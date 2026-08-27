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
import { getMatchKind, getRelatedLinks, type LinkReason } from '../../sync'
import type { Assessment, ColumnId } from '../../types'
import type { PresenceUser } from '../../presence'
import { Card } from './Card'
import { AlignCell, Column } from './Column'
import {
  buildAlignRows,
  itemsByColumn,
  type SortKey,
} from './filters'

interface Props {
  items: Assessment[]
  visible: Assessment[]
  sortKey: SortKey
  hoveredId: string | null
  onHoverChange: (id: string | null) => void
  editorsByCard: Map<string, PresenceUser[]>
  onEdit: (item: Assessment) => void
  onMove: (id: string, column: ColumnId) => void
}

function parseCardId(dragId: string) {
  const sep = dragId.indexOf('::')
  return sep >= 0 ? dragId.slice(0, sep) : dragId
}

function columnFromOverId(overId: string, items: Assessment[]): ColumnId | null {
  if (overId === 'd' || overId === 'm' || overId === 'done') {
    return overId
  }
  if (overId.startsWith('d:')) return 'd'
  if (overId.startsWith('m:')) return 'm'
  if (overId.startsWith('done:')) return 'done'

  const sep = overId.indexOf('::')
  if (sep >= 0) {
    const col = overId.slice(sep + 2) as ColumnId
    if (col === 'd' || col === 'm' || col === 'done') return col
  }

  const card = items.find((i) => i.id === parseCardId(overId))
  return card?.column ?? null
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
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
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

  const alignRows = useMemo(
    () => buildAlignRows(visible, items, sortKey),
    [visible, items, sortKey],
  )

  const doneItems = useMemo(() => itemsByColumn(visible, 'done'), [visible])

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
        item={item}
        match={item.column === 'done' ? 'none' : getMatchKind(item, items)}
        editors={editorsByCard.get(item.id)}
        linkState={linkStateFor(item.id)}
        linkReasons={
          (relatedLinks?.get(item.id) as LinkReason[] | undefined) ?? []
        }
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
    const targetColumn = columnFromOverId(String(over.id), items)
    if (!targetColumn) return
    onMove(parseCardId(String(active.id)), targetColumn)
  }

  const dCol = COLUMNS.find((c) => c.id === 'd')!
  const mCol = COLUMNS.find((c) => c.id === 'm')!
  const doneCol = COLUMNS.find((c) => c.id === 'done')!
  const dCount = alignRows.filter((r) => r.d).length
  const mCount = alignRows.filter((r) => r.m).length

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="board">
        <div className="board-pair">
          <div className="board-pair__heads">
            <Column
              id={dCol.id}
              title={dCol.title}
              subtitle={dCol.subtitle}
              count={dCount}
              headOnly
            />
            <Column
              id={mCol.id}
              title={mCol.title}
              subtitle={mCol.subtitle}
              count={mCount}
              headOnly
            />
          </div>
          <div className="board-pair__body">
            {alignRows.map((row) => (
              <div className="align-row" key={row.key}>
                <AlignCell dropId={`d:${row.key}`}>
                  {row.d ? (
                    renderCard(row.d, 'd')
                  ) : (
                    <div className="card-slot" aria-hidden />
                  )}
                </AlignCell>
                <AlignCell dropId={`m:${row.key}`}>
                  {row.m ? (
                    renderCard(row.m, 'm')
                  ) : (
                    <div className="card-slot" aria-hidden />
                  )}
                </AlignCell>
              </div>
            ))}
          </div>
        </div>

        <Column
          id={doneCol.id}
          title={doneCol.title}
          subtitle={doneCol.subtitle}
          count={doneItems.length}
        >
          {doneItems.map((item) => renderCard(item, 'done'))}
        </Column>
      </div>

      <DragOverlay>
        {activeItem ? (
          <Card
            item={activeItem}
            match={getMatchKind(activeItem, items)}
            onEdit={() => {}}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
