import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type TouchEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { isUnknownProfessor, professorLabel } from '../../professors'
import { useWhere } from './where-context'
import {
  DAY_FULL,
  DAY_SHORT,
  formatDayDate,
  isoOfWeekday,
  mergeLessons,
  weekKindLabel,
  type MergedSlot,
  type Presence,
} from './schedule'

function stopDrag(e: PointerEvent | MouseEvent | TouchEvent) {
  e.stopPropagation()
}

export function WhereChip({ name }: { name: string }) {
  const [open, setOpen] = useState(false)
  const { ready, presenceFor } = useWhere()
  if (isUnknownProfessor(name) || !ready) return null
  const presence = presenceFor(name)
  if (presence.kind === 'unknown' || !presence.teacher) return null

  const here = presence.kind === 'in_class' || presence.kind === 'between'

  return (
    <>
      <button
        type="button"
        className={`where-chip where-chip--${presence.kind}${here ? ' where-chip--here' : ''}`}
        title={presence.detail || 'Расписание преподавателя'}
        aria-label={`Где сейчас: ${presence.label}`}
        onPointerDown={stopDrag}
        onMouseDown={stopDrag}
        onTouchStart={stopDrag}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
      >
        {presence.kind === 'in_class' ? (
          <>
            <span className="where-chip__dot" aria-hidden />
            <span className="where-chip__room">{presence.cabinet}</span>
            <span className="where-chip__time">
              {presence.start}–{presence.end}
            </span>
          </>
        ) : presence.kind === 'between' ? (
          <>
            <span className="where-chip__dot" aria-hidden />
            <span>между парами</span>
            {presence.next ? (
              <span className="where-chip__time">
                {presence.next.cabinet} с {presence.next.start}
              </span>
            ) : null}
          </>
        ) : (
          <span>{presence.label}</span>
        )}
      </button>
      {open
        ? createPortal(
            <WhereModal
              name={name}
              presence={presence}
              onClose={() => setOpen(false)}
            />,
            document.body,
          )
        : null}
    </>
  )
}

function WhereModal({
  name,
  presence,
  onClose,
}: {
  name: string
  presence: Presence
  onClose: () => void
}) {
  const titleId = useId()
  const closeOnBackdrop = useRef(false)
  const { weekLabel, weekKind, clockDate, clockDay, clockMinutes, lessonsFor } =
    useWhere()
  const [day, setDay] = useState(clockDay > 5 ? 0 : clockDay)
  const [bothWeeks, setBothWeeks] = useState(false)
  const teacher = presence.teacher!

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const lessons = lessonsFor(teacher.id)
  const daysWithPairs = useMemo(() => {
    const set = new Set<number>()
    for (const d of [0, 1, 2, 3, 4, 5]) {
      const date = isoOfWeekday(clockDate, clockDay, d)
      const slots = mergeLessons(lessons, {
        date,
        week: weekKind,
        day: d,
        bothWeeks,
      })
      if (slots.length) set.add(d)
    }
    return set
  }, [lessons, clockDate, clockDay, weekKind, bothWeeks])

  const date = isoOfWeekday(clockDate, clockDay, day)
  const slots = mergeLessons(lessons, {
    date,
    week: weekKind,
    day,
    bothWeeks,
  })

  return (
    <div
      className="modal-backdrop where-modal"
      onMouseDown={(e) => {
        closeOnBackdrop.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && closeOnBackdrop.current) onClose()
        closeOnBackdrop.current = false
      }}
      role="presentation"
    >
      <div
        className="where-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="where-sheet__head">
          <div>
            <p className="where-sheet__kicker">{weekLabel}</p>
            <h2 id={titleId}>{professorLabel(name)}</h2>
            <p className="where-sheet__now">{presence.label}</p>
            {presence.detail ? (
              <p className="where-sheet__detail">{presence.detail}</p>
            ) : null}
          </div>
          <a
            className="where-sheet__src"
            href="https://schedule.vstu.by/"
            target="_blank"
            rel="noreferrer"
          >
            schedule.vstu.by
          </a>
        </header>

        <div className="where-days" role="tablist" aria-label="День недели">
          {[0, 1, 2, 3, 4, 5].map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={day === d}
              className={`where-days__btn${day === d ? ' is-on' : ''}${d === clockDay ? ' is-today' : ''}`}
              onClick={() => setDay(d)}
            >
              <span>{DAY_SHORT[d]}</span>
              <span>{formatDayDate(clockDate, clockDay, d)}</span>
              {daysWithPairs.has(d) ? (
                <i className="where-days__dot" aria-hidden />
              ) : null}
            </button>
          ))}
        </div>

        <label className="where-weeks">
          <input
            type="checkbox"
            checked={bothWeeks}
            onChange={(e) => setBothWeeks(e.target.checked)}
          />
          обе недели
        </label>

        <p className="where-sheet__day">
          {DAY_FULL[day]}
          {day === clockDay ? ' · сегодня' : ''}
          {bothWeeks ? '' : ` · ${weekKindLabel(weekKind)}`}
        </p>

        {slots.length === 0 ? (
          <p className="where-empty">Нет занятий в этот день</p>
        ) : (
          <ol className="where-slots">
            {slots.map((slot) => (
              <SlotRow
                key={`${slot.num}-${slot.cabinet}-${slot.title}-${slot.week}-${slot.groups.join(',')}`}
                slot={slot}
                isToday={day === clockDay}
                minutes={clockMinutes}
                bothWeeks={bothWeeks}
              />
            ))}
          </ol>
        )}

        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  )
}

function SlotRow({
  slot,
  isToday,
  minutes,
  bothWeeks,
}: {
  slot: MergedSlot
  isToday: boolean
  minutes: number
  bothWeeks: boolean
}) {
  const isNow = isToday && minutes >= slot.startMin && minutes < slot.endMin
  const isPast = isToday && minutes >= slot.endMin
  const isNext = isToday && !isNow && !isPast && minutes < slot.startMin

  return (
    <li
      className={`where-slot${isNow ? ' where-slot--now' : ''}${isPast ? ' where-slot--past' : ''}`}
    >
      <div className="where-slot__time">
        <span>{slot.start}</span>
        <span>{slot.end}</span>
      </div>
      <div className="where-slot__body">
        <p className="where-slot__cab">
          {slot.cabinet}
          {slot.kind ? <span>{slot.kind}</span> : null}
          {bothWeeks && slot.week !== 'always' ? (
            <span>{weekKindLabel(slot.week)}</span>
          ) : null}
          {slot.corr ? <span>заоч.</span> : null}
          {isNow ? <span className="where-slot__live">сейчас</span> : null}
          {isNext && minutes >= slot.startMin - 20 ? (
            <span className="where-slot__live">скоро</span>
          ) : null}
        </p>
        <p className="where-slot__title">{slot.title}</p>
        {slot.groups.length ? (
          <p className="where-slot__groups">{slot.groups.join(' · ')}</p>
        ) : null}
      </div>
    </li>
  )
}
