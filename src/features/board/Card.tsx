import type { MouseEvent, PointerEvent } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { Assessment, MatchKind } from '../../types'
import { TYPE_LABEL } from '../../types'
import type { PresenceUser } from '../../presence'
import type { LinkReason } from '../../sync'

interface CardProps {
  item: Assessment
  match: MatchKind
  onEdit: (item: Assessment) => void
  editors?: PresenceUser[]
  linkState?: 'idle' | 'focus' | 'related' | 'dim'
  linkReasons?: LinkReason[]
  onHoverChange?: (id: string | null) => void
  /** Unique dnd id when the same card is shown in two columns */
  dragId?: string
}

function reasonLabel(reasons: LinkReason[]) {
  const hasShared = reasons.includes('shared')
  const hasSubj = reasons.includes('subject')
  const hasProf = reasons.includes('professor')
  if (hasShared && hasSubj) return 'связь: тот же предмет · есть у обоих'
  if (hasSubj && hasProf) return 'связь: предмет + препод'
  if (hasSubj) return 'связь: тот же предмет'
  if (hasProf) return 'связь: тот же препод'
  return null
}

export function Card({
  item,
  match,
  onEdit,
  editors = [],
  linkState = 'idle',
  linkReasons = [],
  onHoverChange,
  dragId,
}: CardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: dragId ?? item.id })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined

  function stopDrag(e: PointerEvent | MouseEvent) {
    e.stopPropagation()
  }

  const hoverLink = reasonLabel(linkReasons)
  const both = item.owners.includes('D') && item.owners.includes('M')

  return (
    <article
      ref={setNodeRef}
      style={style}
      data-card-id={item.id}
      className={`card ${isDragging ? 'card--dragging' : ''} ${editors.length ? 'card--busy' : ''} ${both ? 'card--shared-owners' : ''} match-${match} card--link-${linkState}`}
      {...listeners}
      {...attributes}
      onMouseEnter={() => onHoverChange?.(item.id)}
      onMouseLeave={() => onHoverChange?.(null)}
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

      {both && <p className="card__match card__match--shared">нужно D и M</p>}
      {!both && match === 'ideal' && (
        <p className="card__match card__match--ideal">
          тот же предмет · тот же препод
        </p>
      )}
      {!both && match === 'subject' && (
        <p className="card__match card__match--subject">
          общий предмет · разный препод
        </p>
      )}
      {!both && match === 'professor' && (
        <p className="card__match card__match--professor">общий преподаватель</p>
      )}
      {hoverLink && linkState === 'related' && (
        <p className="card__match card__match--hover">{hoverLink}</p>
      )}
      {linkState === 'focus' && (
        <p className="card__match card__match--hover">
          {linkReasons.includes('shared')
            ? 'есть у обоих · смотри связанные'
            : linkReasons.length
              ? 'смотри связанные'
              : 'нет явных связей'}
        </p>
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
