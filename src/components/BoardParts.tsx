import type { ReactNode } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { Assessment, MatchKind } from '../types'

interface CardProps {
  item: Assessment
  match: MatchKind
  onEdit: (item: Assessment) => void
}

export function Card({ item, match, onEdit }: CardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: item.id })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`card ${isDragging ? 'card--dragging' : ''} match-${match}`}
      {...listeners}
      {...attributes}
      onDoubleClick={() => onEdit(item)}
    >
      <header className="card__head">
        <span className="card__short">{item.short}</span>
        <span className={`card__type card__type--${item.type}`}>
          {item.type === 'exam' ? 'экзамен' : 'зачёт'}
        </span>
      </header>

      <h3 className="card__subject">{item.subject}</h3>
      <p className="card__prof">{item.professor}</p>

      {match !== 'none' && (
        <p className={`card__match card__match--${match}`}>
          {match === 'ideal'
            ? 'общий предмет + препод'
            : 'общий преподаватель'}
        </p>
      )}

      {item.note && <p className="card__note">{item.note}</p>}

      <footer className="card__owners">
        {item.owners.map((o) => (
          <span key={o} className={`owner owner--${o}`}>
            {o === 'D' ? 'Д' : 'M'}
          </span>
        ))}
      </footer>
    </article>
  )
}

interface ColumnProps {
  id: string
  title: string
  subtitle: string
  children: ReactNode
  count: number
}

export function Column({ id, title, subtitle, children, count }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <section
      ref={setNodeRef}
      className={`column column--${id} ${isOver ? 'column--over' : ''}`}
    >
      <header className="column__head">
        <div>
          <h2 className="column__title">{title}</h2>
          <p className="column__sub">{subtitle}</p>
        </div>
        <span className="column__count">{count}</span>
      </header>
      <div className="column__list">{children}</div>
    </section>
  )
}
