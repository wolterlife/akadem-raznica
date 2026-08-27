import { useMemo, useState } from 'react'
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
  const [profFilter, setProfFilter] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('links')

  const { hoveredId, onCardHover } = useCardHover()
  const { identity, setIdentity, online, editorsByCard, renameSelf } =
    usePresenceSession(shared, editing?.id ?? null)

  const professors = useMemo(() => listProfessors(items), [items])
  const subjects = useMemo(() => listSubjects(items), [items])
  const visible = useMemo(
    () =>
      filterAndSortItems(items, {
        matchFilter,
        typeFilter,
        profFilter,
        sortKey,
      }),
    [items, matchFilter, typeFilter, profFilter, sortKey],
  )
  const stats = useMemo(() => computeStats(items), [items])

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
        professors={professors}
        matchFilter={matchFilter}
        typeFilter={typeFilter}
        profFilter={profFilter}
        sortKey={sortKey}
        refreshing={refreshing}
        onMatchFilter={setMatchFilter}
        onTypeFilter={setTypeFilter}
        onProfFilter={setProfFilter}
        onSortKey={setSortKey}
        onResetDemo={resetDemo}
        onRenameSelf={renameSelf}
        onRefresh={() => void refreshFromDb()}
        onCreate={() => setCreating(true)}
      />

      <KanbanBoard
        items={items}
        visible={visible}
        hoveredId={hoveredId}
        onHoverChange={onCardHover}
        editorsByCard={editorsByCard}
        onEdit={setEditing}
        onMove={moveToColumn}
      />

      <p className="hint">
        Ховер: без прыжков списка · подсветка + подпись «связь: …»
        {shared ? ' · синк 15с' : ''}
      </p>

      {(creating || editing) && (
        <CardForm
          initial={editing}
          subjects={subjects}
          professors={professors}
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
