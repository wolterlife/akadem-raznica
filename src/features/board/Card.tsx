import { useRef, type MouseEvent, type PointerEvent, type TouchEvent } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { Assessment, MatchKind } from '../../types'
import { TYPE_LABEL } from '../../types'
import type { PresenceUser } from '../../presence'
import { getCardBadges } from './badges'

interface CardProps {
  item: Assessment
  match: MatchKind
  allItems: Assessment[]
  onEdit: (item: Assessment) => void
  editors?: PresenceUser[]
  linkState?: 'idle' | 'focus' | 'related' | 'dim'
  onHoverChange?: (id: string | null, col?: string | null) => void
  dragId?: string
  colId?: string
}

const LONG_PRESS_MS = 420

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

  function stopDrag(e: PointerEvent | MouseEvent) {
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
      // keep highlight briefly so user can see related cards
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
  const badges = getCardBadges(item, allItems)

  return (
    <article
      ref={setNodeRef}
      style={style}
      data-card-id={item.id}
      data-col={colId}
      className={`card ${isDragging ? 'card--dragging' : ''} ${editors.length ? 'card--busy' : ''} ${both ? 'card--shared-owners' : ''} match-${match} card--link-${linkState}`}
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

      {badges.length > 0 && (
        <div className="card__badges">
          {badges.map((b) => (
            <span key={b.key} className={`badge badge--${b.kind}`}>
              {b.text}
            </span>
          ))}
        </div>
      )}

      {item.note && <p className="card__note">{item.note}</p>}

      <footer className="card__owners">
        {item.owners.map((o) => (
          <span key={o} className={`owner owner--${o}`}>
            {o}
          </span>
        ))}
      </footer>
    </article>
  )
}
