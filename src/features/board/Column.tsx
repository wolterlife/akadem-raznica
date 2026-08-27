import type { ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'

interface ColumnProps {
  id: string
  title: string
  subtitle: string
  children?: ReactNode
  count: number
  /** Only header (D/M heads above aligned rows) */
  headOnly?: boolean
}

export function Column({
  id,
  title,
  subtitle,
  children,
  count,
  headOnly = false,
}: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  if (headOnly) {
    return (
      <header className={`column__head column__head--pair column--${id}`}>
        <div>
          <h2 className="column__title">{title}</h2>
          <p className="column__sub">{subtitle}</p>
        </div>
        <span className="column__count">{count}</span>
      </header>
    )
  }

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

interface CellProps {
  dropId: string
  children: ReactNode
}

/** Droppable cell inside an aligned D/M row */
export function AlignCell({ dropId, children }: CellProps) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId })
  return (
    <div
      ref={setNodeRef}
      className={`align-row__cell ${isOver ? 'align-row__cell--over' : ''}`}
    >
      {children}
    </div>
  )
}
