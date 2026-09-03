import { useEffect, useMemo, useState } from 'react'
import { setPresenceEditing } from './presence'
import type { Assessment } from './types'
import {
  computeStats,
  filterAndSortItems,
  listProfessors,
  listSubjects,
  type MatchFilter,
  type SortKey,
  type TypeFilter,
} from './features/board/filters'
import { useBoardItems } from './features/board/useBoardItems'
import { useCardHover } from './features/board/useCardHover'
import { KanbanBoard } from './features/board/KanbanBoard'
import { CardForm } from './features/board/CardForm'
import { usePresenceSession } from './features/presence/usePresenceSession'
import { NameGate } from './features/presence/NameGate'
import { BoardHeader } from './features/header/BoardHeader'
import { BurndownPanel } from './features/pace/BurndownPanel'
import { usePace } from './features/pace/usePace'
import { loadProfFilter, saveProfFilter } from './prefs'
import './App.css'

export default function App() {
  const {
    shared,
    items,
    syncStatus,
    refreshing,
    refreshFromDb,
    moveToColumn,
    upsert,
    remove,
    resetDemo,
  } = useBoardItems()

  const [editing, setEditing] = useState<Assessment | null>(null)
  const [creating, setCreating] = useState(false)
  const [matchFilter, setMatchFilter] = useState<MatchFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [profFilter, setProfFilter] = useState(loadProfFilter)
  const [sortKey, setSortKey] = useState<SortKey>('links')
  const [query, setQuery] = useState('')

  const { hoveredId, onCardHover } = useCardHover()
  const { identity, setIdentity, online, editorsByCard, renameSelf } =
    usePresenceSession(shared, editing?.id ?? null)

  const professors = useMemo(() => listProfessors(items), [items])
  const professorOptions = useMemo(() => {
    if (profFilter !== 'all' && !professors.includes(profFilter)) {
      return [profFilter, ...professors]
    }
    return professors
  }, [professors, profFilter])
  const subjects = useMemo(() => listSubjects(items), [items])
  const visible = useMemo(
    () =>
      filterAndSortItems(items, {
        matchFilter,
        typeFilter,
        profFilter,
        sortKey,
        query,
      }),
    [items, matchFilter, typeFilter, profFilter, sortKey, query],
  )
  const stats = useMemo(() => computeStats(items), [items])
  const remaining = useMemo(
    () => ({ D: stats.leftD, M: stats.leftM }),
    [stats.leftD, stats.leftM],
  )
  const totals = useMemo(
    () => ({ D: stats.totalD, M: stats.totalM }),
    [stats.totalD, stats.totalM],
  )
  const { pace, setDates } = usePace(
    shared,
    syncStatus !== 'connecting',
    remaining,
  )

  useEffect(() => {
    saveProfFilter(profFilter)
  }, [profFilter])

  function closeForm() {
    setCreating(false)
    setEditing(null)
    setPresenceEditing(null)
  }

  return (
    <div className="app">
      {shared && !identity && <NameGate onReady={setIdentity} />}
      <div className="glow" aria-hidden />

      <BoardHeader
        syncStatus={syncStatus}
        shared={shared}
        stats={stats}
        online={online}
        identity={identity}
        professors={professorOptions}
        matchFilter={matchFilter}
        typeFilter={typeFilter}
        profFilter={profFilter}
        sortKey={sortKey}
        query={query}
        refreshing={refreshing}
        onMatchFilter={setMatchFilter}
        onTypeFilter={setTypeFilter}
        onProfFilter={setProfFilter}
        onSortKey={setSortKey}
        onQuery={setQuery}
        onResetDemo={resetDemo}
        onRenameSelf={renameSelf}
        onRefresh={() => void refreshFromDb()}
        onCreate={() => setCreating(true)}
      />

      <KanbanBoard
        items={items}
        visible={visible}
        sortKey={sortKey}
        hoveredId={hoveredId}
        onHoverChange={onCardHover}
        editorsByCard={editorsByCard}
        onEdit={setEditing}
        onMove={moveToColumn}
      />

      <BurndownPanel
        pace={pace}
        totals={totals}
        remaining={remaining}
        onDates={setDates}
      />

      <p className="hint">
        Наведи или удержи палец — подсветятся связанные карточки. Перенос из
        своего столбца в Done закрывает предмет только у тебя.
        {shared ? ' · синк 15с' : ''}
      </p>

      {(creating || editing) && (
        <CardForm
          initial={editing}
          subjects={subjects}
          professors={professorOptions}
          onClose={closeForm}
          onSave={(item) => {
            upsert(item)
            closeForm()
          }}
          onDelete={
            editing
              ? (id) => {
                  remove(id)
                  closeForm()
                }
              : undefined
          }
        />
      )}
    </div>
  )
}
