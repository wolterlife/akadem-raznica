import { ExamCard } from './ExamCard'
import { useSession } from './useSession'

export function SessionTab({ shared }: { shared: boolean }) {
  const { bundle, loading, exams, now, progressOf, update } = useSession(shared)
  const passed = exams.filter((e) => progressOf(e).status === 'passed').length

  return (
    <section className="session">
      <div className="session__top">
        <div>
          <h2>Сессия · ЗИт-3в, 1 подгруппа</h2>
          <p className="session__lead">
            Бобрик Д.В. · экзамены и пары из расписания ВГТУ
            {bundle && !bundle.live ? ' (кэш)' : ''}
          </p>
        </div>
        {exams.length > 0 && (
          <p className="session__sum">
            сдано <strong>{passed}</strong> из {exams.length}
          </p>
        )}
      </div>
      {loading && <p className="session__lead">Загружаю расписание…</p>}
      {!loading && !exams.length && (
        <p className="session__lead">Экзаменов в расписании не найдено.</p>
      )}
      <div className="session__grid">
        {exams.map((exam) => (
          <ExamCard
            key={exam.key}
            exam={exam}
            now={now}
            progress={progressOf(exam)}
            onChange={(patch) => update(exam, patch)}
          />
        ))}
      </div>
    </section>
  )
}
