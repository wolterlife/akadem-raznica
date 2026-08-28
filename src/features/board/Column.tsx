import type { ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'

interface ColumnProps {
  id: string
  title: string
  subtitle: string
  children?: ReactNode
  count: number
}

export function Column({ id, title, subtitle, children, count }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <section
      id={`col-${id}`}
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
