import { useState } from 'react'
import type { Owner } from '../../types'
import { loadPaceCountPending, savePaceCountPending } from '../../prefs'
import { BurndownChart } from './BurndownChart'
import {
  formatDay,
  hasRange,
  personWithoutPending,
  snapshotFor,
  todayKey,
  type PaceState,
  type PersonDatePatch,
  type PersonPace,
} from './pace'

interface Props {
  pace: PaceState
  totals: Record<Owner, number>
  remaining: Record<Owner, number>
  must: Record<Owner, number>
  sure: Record<Owner, number>
  onDates: (owner: Owner, patch: PersonDatePatch) => void
}

const OWNERS: Owner[] = ['D', 'M']

function statusText(
  status: ReturnType<typeof snapshotFor>['status'],
  delta: number,
  startedAt: string,
) {
  if (status === 'setup') return 'укажи старт и дедлайн'
  if (status === 'waiting') return `ещё готовимся · старт ${formatDay(startedAt)}`
  if (status === 'done') return 'всё закрыто'
  if (status === 'ahead') return `опережение на ${delta}`
  if (status === 'behind') return `отставание на ${Math.abs(delta)}`
  return 'в графике'
}

function viewOf(
  owner: Owner,
  includePending: boolean,
  totals: Record<Owner, number>,
  remaining: Record<Owner, number>,
  must: Record<Owner, number>,
  sure: Record<Owner, number>,
  person: PersonPace | null,
) {
  if (includePending) {
    return {
      total: totals[owner],
      left: remaining[owner],
      person,
    }
  }
  const pendingLeft = Math.max(0, remaining[owner] - must[owner])
  const total = sure[owner]
  return {
    total,
    left: must[owner],
    person: person
      ? personWithoutPending(person, pendingLeft, total)
      : person,
  }
}

function DateField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: string
  min?: string
  max?: string
  onChange: (next: string | null) => void
}) {
  return (
    <label className="burn__due">
      <span>{label}</span>
      <input
        type="date"
        value={value}
        min={min || undefined}
        max={max || undefined}
        onChange={(e) => onChange(e.target.value || null)}
      />
    </label>
  )
}

export function BurndownPanel({
  pace,
  totals,
  remaining,
  must,
  sure,
  onDates,
}: Props) {
  const today = todayKey()
  const [includePending, setIncludePending] = useState(loadPaceCountPending)

  function setScope(next: boolean) {
    setIncludePending(next)
    savePaceCountPending(next)
  }

  return (
    <section className="pace" aria-label="Темп к дедлайну">
      {OWNERS.map((owner) => {
        const stored = pace[owner]
        const view = viewOf(
          owner,
          includePending,
          totals,
          remaining,
          must,
          sure,
          stored,
        )
        const total = view.total
        const left = view.left
        const person = view.person
        const snap = person ? snapshotFor(total, left, person, today) : null
        const ready = hasRange(person)
        const hasSession = Boolean(person?.sessionStart && person?.sessionEnd)

        return (
          <article key={owner} className="burn">
            <header className="burn__head">
              <div>
                <h2 className="burn__title">{owner}</h2>
                <p className="burn__lead">
                  {ready
                    ? `с ${formatDay(person.startedAt)} к ${formatDay(person.due)} ${
                        includePending ? 'все карточки' : 'обязательные карточки'
                      } должны быть закрыты`
                    : 'старт можно поставить позже — пока только готовитесь'}
                  {hasSession
                    ? ` · сессия ${formatDay(person!.sessionStart!)}–${formatDay(person!.sessionEnd!)}`
                    : ''}
                </p>
              </div>
            </header>

            <div className="burn__dates">
              <div className="burn__dates-group" role="group" aria-label="Темп">
                <p className="burn__dates-label">темп</p>
                <div className="burn__dates-row">
                  <DateField
                    label="старт"
                    value={person?.startedAt ?? ''}
                    max={person?.due || undefined}
                    onChange={(startedAt) => onDates(owner, { startedAt })}
                  />
                  <DateField
                    label="дедлайн"
                    value={person?.due ?? ''}
                    min={person?.startedAt || undefined}
                    onChange={(due) => onDates(owner, { due })}
                  />
                </div>
              </div>
              <div className="burn__dates-group" role="group" aria-label="Сессия">
                <p className="burn__dates-label">сессия</p>
                <div className="burn__dates-row">
                  <DateField
                    label="начало"
                    value={person?.sessionStart ?? ''}
                    max={person?.sessionEnd || undefined}
                    onChange={(sessionStart) => onDates(owner, { sessionStart })}
                  />
                  <DateField
                    label="финиш"
                    value={person?.sessionEnd ?? ''}
                    min={person?.sessionStart || undefined}
                    onChange={(sessionEnd) => onDates(owner, { sessionEnd })}
                  />
                </div>
              </div>
            </div>

            {ready && person && snap ? (
              <>
                <div className="burn__metrics">
                  <p className="burn__pending">
                    осталось <strong>{snap.left}</strong>
                  </p>
                  {snap.status === 'waiting' ? (
                    <p className="burn__compare">
                      сдано {snap.done} из {total} · график с{' '}
                      {formatDay(person.startedAt)}
                    </p>
                  ) : (
                    <p className="burn__compare">
                      сдано {snap.done} из {total} · к сегодня {snap.shouldBeDone}
                    </p>
                  )}
                  <p className={`burn__status burn__status--${snap.status}`}>
                    {statusText(snap.status, snap.delta, person.startedAt)}
                  </p>
                </div>
                <BurndownChart
                  person={person}
                  total={total}
                  left={left}
                  today={today}
                />
                <p className="burn__legend">
                  <span className="burn__legend-now">сейчас</span>
                  <span className="burn__legend-ideal">идеальный темп</span>
                  {hasSession ? (
                    <span className="burn__legend-session">сессия</span>
                  ) : null}
                </p>
              </>
            ) : (
              <p className="burn__empty">
                Укажи старт и дедлайн. Старт — день, с которого начинается
                график, не обязательно сегодня. Сессию можно задать отдельно —
                на графике отметится зона.
              </p>
            )}
          </article>
        )
      })}

      <div className="pace__scope" role="group" aria-label="Что считать в графике">
        <span className="pace__scope-label">отсчёт</span>
        <div className="filters">
          <button
            type="button"
            className={includePending ? 'chip chip--on' : 'chip'}
            aria-pressed={includePending}
            onClick={() => setScope(true)}
          >
            все
          </button>
          <button
            type="button"
            className={!includePending ? 'chip chip--on' : 'chip'}
            aria-pressed={!includePending}
            onClick={() => setScope(false)}
          >
            без под вопросом
          </button>
        </div>
      </div>
    </section>
  )
}
