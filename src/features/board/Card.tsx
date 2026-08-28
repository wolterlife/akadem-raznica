import { useRef, type MouseEvent, type PointerEvent, type TouchEvent } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { Assessment, ColumnId, MatchKind, Owner } from '../../types'
import { TYPE_LABEL } from '../../types'
import type { PresenceUser } from '../../presence'
import { getCardBadges, listCardRelations, relationCaption } from './badges'
import { columnOwner, isDoneFor, isFullyDone, noteFor } from './progress'

interface CardProps {
  item: Assessment
  match: MatchKind
  allItems: Assessment[]
  onEdit: (item: Assessment) => void
  editors?: PresenceUser[]
  linkState?: 'idle' | 'focus' | 'related' | 'dim'
  onHoverChange?: (id: string | null, col?: string | null) => void
  dragId?: string
  colId?: ColumnId
}

const LONG_PRESS_MS = 420

function viewOwner(colId?: ColumnId): Owner | null {
  return colId ? columnOwner(colId) : null
}

export function Card({
  item,
  match,
  allItems,
  onEdit,
  editors = [],
  linkState = 'idle',
  onHoverChange,
  dragId,
  colId,
}: CardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: dragId ?? item.id })
  const pressTimer = useRef<number | null>(null)
  const pressed = useRef(false)

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined

  function stopDrag(e: PointerEvent | MouseEvent | TouchEvent) {
    e.stopPropagation()
  }

  function clearPress() {
    if (pressTimer.current != null) {
      window.clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }

  function onTouchStart(_e: TouchEvent) {
    clearPress()
    pressed.current = false
    pressTimer.current = window.setTimeout(() => {
      pressed.current = true
      onHoverChange?.(item.id, colId)
    }, LONG_PRESS_MS)
  }

  function onTouchEnd() {
    clearPress()
    if (pressed.current) {
      window.setTimeout(() => onHoverChange?.(null), 1600)
      pressed.current = false
    }
  }

  function onTouchCancel() {
    clearPress()
    pressed.current = false
    onHoverChange?.(null)
  }

  const both = item.owners.includes('D') && item.owners.includes('M')
  const owner = viewOwner(colId)
  const done = isFullyDone(item)
  const badges = getCardBadges(item, allItems, owner)
  const matchBadge = badges.find((b) => b.scope === 'external')
  const internal = badges.filter((b) => b.scope === 'internal')
  const internalRelations = done
    ? []
    : listCardRelations(item, allItems, owner)
  const showInternal =
    !done && (internal.length > 0 || internalRelations.length > 0)
  const personalNote = noteFor(item, owner)
  const showBothNotes = colId === 'done' || (!owner && both)
  const noteD = noteFor(item, 'D')
  const noteM = noteFor(item, 'M')

  return (
    <article
      ref={setNodeRef}
      style={style}
      data-card-id={item.id}
      data-col={colId}
      className={`card ${isDragging ? 'card--dragging' : ''} ${editors.length ? 'card--busy' : ''} ${both ? 'card--shared-owners' : ''} ${done ? 'card--in-done' : ''} match-${match} card--link-${linkState}`}
      {...listeners}
      {...attributes}
      onMouseEnter={() => onHoverChange?.(item.id, colId)}
      onMouseLeave={() => onHoverChange?.(null)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      onContextMenu={(e) => {
        if (pressed.current) e.preventDefault()
      }}
    >
      {editors.length > 0 && (
        <div className="card__presence" aria-label="Сейчас редактируют">
          {editors.map((u) => (
            <span
              key={u.id}
              className="presence-dot"
              style={{ background: u.color }}
              title={`${u.name} редактирует`}
            >
              {u.name.slice(0, 1).toUpperCase()}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        className="card__edit"
        aria-label="Редактировать"
        title="Редактировать"
        onPointerDown={stopDrag}
        onMouseDown={stopDrag}
        onTouchStart={stopDrag}
        onClick={(e) => {
          e.stopPropagation()
          onEdit(item)
        }}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
          <path
            fill="currentColor"
            d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.33H5v-.92l8.06-8.06.92.92L5.92 19.58zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
          />
        </svg>
      </button>

      <header className="card__head">
        <span className="card__short">{item.short}</span>
        <span className={`card__type card__type--${item.type}`}>
          {TYPE_LABEL[item.type]}
        </span>
      </header>

      <h3 className="card__subject">{item.subject}</h3>
      <p className="card__prof">
        {item.professor.trim() || 'препод не указан'}
      </p>

      {matchBadge && (
        <div className="card__group">
          <p className="card__group-label">между D и M</p>
          <p
            className={`card__match ${
              matchBadge.kind === 'ideal'
                ? 'card__match--full'
                : matchBadge.kind === 'professor'
                  ? 'card__match--prof'
                  : 'card__match--partial'
            }`}
          >
            {matchBadge.text}
          </p>
        </div>
      )}

      {showInternal ? (
        <div className="card__group">
          <p className="card__group-label">
            {owner ? `у ${owner}` : `у ${item.owners[0]}`}
          </p>
          {internal.map((b) => (
            <p key={b.key} className="card__match card__match--internal">
              {b.text}
            </p>
          ))}
          {internalRelations.map((rel) => {
            const cap = relationCaption(item, rel)
            return (
              <p key={rel.id} className="card__match card__match--internal">
                {cap.title ? `${cap.title} · ${cap.why}` : cap.why}
              </p>
            )
          })}
        </div>
      ) : null}

      {showBothNotes ? (
        <>
          {noteD ? (
            <p className="card__note">
              <span className="card__note-who">D</span>
              {noteD}
            </p>
          ) : null}
          {noteM ? (
            <p className="card__note">
              <span className="card__note-who">M</span>
              {noteM}
            </p>
          ) : null}
        </>
      ) : (
        personalNote && <p className="card__note">{personalNote}</p>
      )}

      <footer className="card__owners">
        {item.owners.map((o) => (
          <span
            key={o}
            className={`owner owner--${o} ${owner === o ? 'owner--here' : ''} ${isDoneFor(item, o) ? 'owner--done' : ''}`}
          >
            {o}
          </span>
        ))}
      </footer>
    </article>
  )
}
