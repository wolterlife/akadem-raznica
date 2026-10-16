import { useState } from 'react'
import { PAIR_TIMES } from '../whereabouts/schedule'
import { cabinet, daysUntil, fmtDate, lessonStart, warsawTime, type ExamInfo } from './schedule'
import { STATUS_LABEL, type ExamProgress, type ExamStatus } from './store'

interface Props {
  exam: ExamInfo
  progress: ExamProgress
  now: number
  onChange: (patch: Partial<ExamProgress>) => void
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

export function ExamCard({ exam, progress, now, onChange }: Props) {
  const [newLab, setNewLab] = useState('')
  const days = daysUntil(exam.date, now)
  const past = exam.startsAt + 95 * 60_000 < now
  const labsDone = progress.labs.filter((l) => l.done).length
  const countdown = past
    ? 'прошёл'
    : days <= 0
      ? 'сегодня'
      : days === 1
        ? 'завтра'
        : `через ${days} ${plural(days, 'день', 'дня', 'дней')}`

  function addLab() {
    const text = newLab.trim()
    if (!text) return
    onChange({ labs: [...progress.labs, { id: crypto.randomUUID(), text, done: false }] })
    setNewLab('')
  }

  return (
    <article className={`exam exam--${progress.status}${past ? ' exam--past' : ''}`}>
      <header className="exam__head">
        <div>
          <h3 className="exam__title">{exam.title}</h3>
          <p className="exam__meta">
            {fmtDate(exam.date)} · {exam.start}–{exam.end} Минск ({warsawTime(exam.startsAt)} PL)
            {exam.room ? ` · ауд. ${exam.room}` : ''}
            {exam.teacher ? ` · ${exam.teacher}` : ''}
          </p>
        </div>
        <div className="exam__count">
          <strong>{countdown}</strong>
          {!past && (
            <span>
              {exam.before.length
                ? `${exam.before.length} ${plural(exam.before.length, 'пара', 'пары', 'пар')} до экзамена`
                : 'пар до экзамена нет'}
            </span>
          )}
        </div>
      </header>

      {!past && exam.before.length > 0 && (
        <ul className="exam__pairs">
          {exam.before.map((l) => (
            <li key={`${l.date}-${l.num}-${l.sub}`}>
              {fmtDate(l.date)} {PAIR_TIMES[l.num]?.[0]} ({warsawTime(lessonStart(l))} PL) · {l.kind.toLowerCase()}
              {l.sub ? ` (${l.sub} подгр.)` : ''} · ауд. {cabinet(l.frame, l.room)} · {l.teacher}
            </li>
          ))}
        </ul>
      )}

      <label className="exam__field">
        <span>Формат сдачи</span>
        <input
          value={progress.format}
          placeholder="билеты / проект / защита лаб…"
          onChange={(e) => onChange({ format: e.target.value })}
        />
      </label>

      <div className="exam__field">
        <span>
          Допуск: лабы {progress.labs.length ? `${labsDone}/${progress.labs.length}` : ''}
        </span>
        <ul className="exam__labs">
          {progress.labs.map((lab) => (
            <li key={lab.id}>
              <label>
                <input
                  type="checkbox"
                  checked={lab.done}
                  onChange={() =>
                    onChange({
                      labs: progress.labs.map((x) => (x.id === lab.id ? { ...x, done: !x.done } : x)),
                    })
                  }
                />
                <span className={lab.done ? 'is-done' : ''}>{lab.text}</span>
              </label>
              <button
                type="button"
                className="exam__x"
                aria-label="Удалить"
                onClick={() => onChange({ labs: progress.labs.filter((x) => x.id !== lab.id) })}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="exam__add">
          <input
            value={newLab}
            placeholder="добавить лабу"
            onChange={(e) => setNewLab(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addLab()}
          />
          <button type="button" className="btn btn--ghost" onClick={addLab}>
            +
          </button>
        </div>
      </div>

      <label className="exam__field">
        <span>Материалы и что будет на экзамене</span>
        <textarea
          rows={3}
          value={progress.materials}
          placeholder="вопросы, методички, ссылки на лекции"
          onChange={(e) => onChange({ materials: e.target.value })}
        />
      </label>

      <div className="exam__status">
        {(Object.keys(STATUS_LABEL) as ExamStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            className={`chip${progress.status === s ? ' chip--on' : ''}`}
            onClick={() => onChange({ status: s })}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
        {(progress.status === 'passed' || progress.grade) && (
          <input
            className="exam__grade"
            value={progress.grade}
            placeholder="оценка"
            inputMode="numeric"
            onChange={(e) => onChange({ grade: e.target.value })}
          />
        )}
      </div>
    </article>
  )
}
