import type { Identity, PresenceUser } from '../../presence'
import type { SyncStatus } from '../../sync'
import type {
  MatchFilter,
  SortKey,
  TypeFilter,
} from '../board/filters'

interface Stats {
  open: number
  ideal: number
  alike: number
  subject: number
  professor: number
  done: number
}

interface Props {
  syncStatus: SyncStatus
  shared: boolean
  stats: Stats
  online: PresenceUser[]
  identity: Identity | null
  professors: string[]
  matchFilter: MatchFilter
  typeFilter: TypeFilter
  profFilter: string
  sortKey: SortKey
  refreshing: boolean
  onMatchFilter: (v: MatchFilter) => void
  onTypeFilter: (v: TypeFilter) => void
  onProfFilter: (v: string) => void
  onSortKey: (v: SortKey) => void
  onResetDemo: () => void
  onRenameSelf: () => void
  onRefresh: () => void
  onCreate: () => void
}

function statusLabel(syncStatus: SyncStatus) {
  if (syncStatus === 'shared') return 'общая доска · pull 15с'
  if (syncStatus === 'connecting') return 'подключение…'
  if (syncStatus === 'error') return 'ошибка синка'
  return 'локально · только этот браузер'
}

export function BoardHeader({
  syncStatus,
  shared,
  stats,
  online,
  identity,
  professors,
  matchFilter,
  typeFilter,
  profFilter,
  sortKey,
  refreshing,
  onMatchFilter,
  onTypeFilter,
  onProfFilter,
  onSortKey,
  onResetDemo,
  onRenameSelf,
  onRefresh,
  onCreate,
}: Props) {
  return (
    <header className="top">
      <div className="brand">
        <p className="brand__mark">академ-разница</p>
        <h1>Канбан сдач</h1>
        <p className="brand__lead">
          D и M закрывают разницу. Карточка с галочками D+M нужна обоим.
          Ховер подсветит тот же предмет или того же препода.
        </p>
        <p className={`sync-badge sync-badge--${syncStatus}`}>
          {statusLabel(syncStatus)}
        </p>
        <ul className="legend" aria-label="Как читать доску">
          <li>
            <span className="legend__swatch legend__swatch--shared" />
            D+M — одна сдача на двоих
          </li>
          <li>
            <span className="legend__swatch legend__swatch--ideal" />
            1 в 1 — предмет, препод и тип
          </li>
          <li>
            <span className="legend__swatch legend__swatch--alike" />
            предмет+препод — другой тип сдачи
          </li>
          <li>
            <span className="legend__swatch legend__swatch--subject" />
            предмет у D/M — разный препод
          </li>
          <li>
            <span className="legend__swatch legend__swatch--prof" />
            препод у D/M — другие предметы
          </li>
        </ul>
        {shared && online.length > 0 && (
          <div className="online" aria-label="Кто онлайн">
            {online.map((u) => (
              <span
                key={u.id}
                className={`online__user ${u.id === identity?.id ? 'online__user--me' : ''}`}
                style={{ ['--u' as string]: u.color }}
                title={
                  u.editingId
                    ? `${u.name} · редактирует карточку`
                    : `${u.name} · на доске`
                }
              >
                <span className="online__dot">
                  {u.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="online__name">{u.name}</span>
                {u.editingId ? <span className="online__edit">✎</span> : null}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="top__side">
        <div className="stats" aria-label="Сводка">
          <div>
            <strong>{stats.open}</strong>
            <span>открыто</span>
          </div>
          <div>
            <strong>{stats.ideal}</strong>
            <span>1 в 1</span>
          </div>
          <div>
            <strong>{stats.alike}</strong>
            <span>почти</span>
          </div>
          <div>
            <strong>{stats.subject}</strong>
            <span>предмет</span>
          </div>
          <div>
            <strong>{stats.professor}</strong>
            <span>препод</span>
          </div>
          <div>
            <strong>{stats.done}</strong>
            <span>done</span>
          </div>
        </div>

        <div className="toolbar">
          <div className="filters" role="group" aria-label="Фильтр совпадений">
            <button
              className={matchFilter === 'all' ? 'chip chip--on' : 'chip'}
              onClick={() => onMatchFilter('all')}
              type="button"
            >
              все
            </button>
            <button
              className={matchFilter === 'ideal' ? 'chip chip--on' : 'chip'}
              onClick={() => onMatchFilter('ideal')}
              type="button"
            >
              1 в 1
            </button>
            <button
              className={matchFilter === 'alike' ? 'chip chip--on' : 'chip'}
              onClick={() => onMatchFilter('alike')}
              type="button"
            >
              почти
            </button>
            <button
              className={matchFilter === 'subject' ? 'chip chip--on' : 'chip'}
              onClick={() => onMatchFilter('subject')}
              type="button"
            >
              общий предм.
            </button>
            <button
              className={matchFilter === 'professor' ? 'chip chip--on' : 'chip'}
              onClick={() => onMatchFilter('professor')}
              type="button"
            >
              общий преп.
            </button>
          </div>

          <label className="filter-select">
            <span>тип</span>
            <select
              value={typeFilter}
              onChange={(e) => onTypeFilter(e.target.value as TypeFilter)}
            >
              <option value="all">все типы</option>
              <option value="exam">экзамен</option>
              <option value="credits">зачёты</option>
              <option value="credit">зачёт</option>
              <option value="diff_credit">дифф.зачёт</option>
              <option value="course_project">курс.пр.</option>
              <option value="coursework">курс.раб.</option>
              <option value="practice">практика</option>
            </select>
          </label>

          <label className="filter-select">
            <span>препод</span>
            <select
              value={profFilter}
              onChange={(e) => onProfFilter(e.target.value)}
            >
              <option value="all">все преподы</option>
              {professors.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-select">
            <span>сорт.</span>
            <select
              value={sortKey}
              onChange={(e) => onSortKey(e.target.value as SortKey)}
            >
              <option value="links">сначала связи</option>
              <option value="subject">по предмету</option>
              <option value="type">по типу</option>
              <option value="prof">по преподу</option>
            </select>
          </label>

          <button className="btn btn--ghost" type="button" onClick={onResetDemo}>
            демо
          </button>
          {shared && identity && (
            <button
              className="btn btn--ghost btn--me"
              type="button"
              onClick={onRenameSelf}
              title="Сменить имя"
              style={{ ['--u' as string]: identity.color }}
            >
              <span className="online__dot">
                {identity.name.slice(0, 1).toUpperCase()}
              </span>
              {identity.name}
            </button>
          )}
          {shared && (
            <button
              className={`btn btn--ghost btn--refresh ${refreshing ? 'is-loading' : ''}`}
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              title="Обновить с сервера"
            >
              <span className="spin" aria-hidden>
                ↻
              </span>
              refresh
            </button>
          )}
          <button className="btn btn--primary" type="button" onClick={onCreate}>
            + карточка
          </button>
        </div>
      </div>
    </header>
  )
}
