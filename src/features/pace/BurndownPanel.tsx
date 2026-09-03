import type { Owner } from '../../types'
import { BurndownChart } from './BurndownChart'
import {
  formatDay,
  hasRange,
  snapshotFor,
  todayKey,
  type PaceState,
} from './pace'

interface Props {
  pace: PaceState
  totals: Record<Owner, number>
  remaining: Record<Owner, number>
  onDates: (
    owner: Owner,
    patch: { startedAt?: string | null; due?: string | null },
  ) => void
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

export function BurndownPanel({ pace, totals, remaining, onDates }: Props) {
  const today = todayKey()

  return (
    <section className="pace" aria-label="Темп к дедлайну">
      {OWNERS.map((owner) => {
        const person = pace[owner]
        const total = totals[owner]
        const left = remaining[owner]
        const snap = person ? snapshotFor(total, left, person, today) : null
        const ready = hasRange(person)

        return (
          <article key={owner} className="burn">
            <header className="burn__head">
              <div>
                <h2 className="burn__title">{owner}</h2>
                <p className="burn__lead">
                  {ready
                    ? `с ${formatDay(person.startedAt)} к ${formatDay(person.due)} все карточки должны быть закрыты`
                    : 'старт можно поставить позже — пока только готовитесь'}
                </p>
              </div>
              <div className="burn__dates">
                <label className="burn__due">
                  <span>старт</span>
                  <input
                    type="date"
                    value={person?.startedAt ?? ''}
                    max={person?.due || undefined}
                    onChange={(e) =>
                      onDates(owner, { startedAt: e.target.value || null })
                    }
                  />
                </label>
                <label className="burn__due">
                  <span>дедлайн</span>
                  <input
                    type="date"
                    value={person?.due ?? ''}
                    min={person?.startedAt || undefined}
                    onChange={(e) =>
                      onDates(owner, { due: e.target.value || null })
                    }
                  />
                </label>
              </div>
            </header>

            {ready && person && snap ? (
              <>
                <div className="burn__metrics">
                  <p className="burn__pending">
                    осталось <strong>{snap.left}</strong>
                  </p>
                  {snap.status === 'waiting' ? (
                    <p className="burn__compare">
                      сдано {snap.done} из {total} · график с {formatDay(person.startedAt)}
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
                </p>
              </>
            ) : (
              <p className="burn__empty">
                Укажи старт и дедлайн. Старт — день, с которого начинается
                график, не обязательно сегодня.
              </p>
            )}
          </article>
        )
      })}
    </section>
  )
}
