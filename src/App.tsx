import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { COLUMNS, SEED } from './data'
import {
  getMatchKind,
  isSyncConfigured,
  loadLocal,
  pushBoard,
  saveLocal,
  subscribeBoard,
  type SyncStatus,
} from './sync'
import type { Assessment, ColumnId } from './types'
import { Card, Column } from './components/BoardParts'
import { CardForm } from './components/CardForm'
import './App.css'

export default function App() {
  const shared = isSyncConfigured()
  const [items, setItems] = useState<Assessment[]>(() =>
    shared ? [] : loadLocal(SEED),
  )
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    shared ? 'connecting' : 'local',
  )
  const [editing, setEditing] = useState<Assessment | null>(null)
  const [creating, setCreating] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'ideal' | 'professor'>('all')
  const readyRef = useRef(!shared)
  const skipPushRef = useRef(false)

  useEffect(() => {
    if (!shared) return

    const unsub = subscribeBoard(
      (remote) => {
        skipPushRef.current = true
        if (remote == null) {
          setItems(SEED)
          void pushBoard(SEED).finally(() => {
            readyRef.current = true
            setSyncStatus('shared')
          })
        } else {
          setItems(remote)
          readyRef.current = true
          setSyncStatus('shared')
        }
      },
      () => setSyncStatus('error'),
    )

    return () => unsub?.()
  }, [shared])

  useEffect(() => {
    if (!readyRef.current) return
    if (skipPushRef.current) {
      skipPushRef.current = false
      return
    }

    if (!shared) {
      saveLocal(items)
      return
    }

    const t = window.setTimeout(() => {
      void pushBoard(items).catch(() => setSyncStatus('error'))
    }, 200)
    return () => window.clearTimeout(t)
  }, [items, shared])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const activeItem = useMemo(
    () => items.find((i) => i.id === activeId) ?? null,
    [items, activeId],
  )

  const visible = useMemo(() => {
    if (filter === 'all') return items
    return items.filter((item) => {
      if (item.column === 'done') return true
      return getMatchKind(item, items) === filter
    })
  }, [items, filter])

  const byColumn = useCallback(
    (column: ColumnId) => visible.filter((i) => i.column === column),
    [visible],
  )

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const overId = String(over.id)
    const columnIds = COLUMNS.map((c) => c.id)
    let targetColumn: ColumnId | null = null

    if (columnIds.includes(overId as ColumnId)) {
      targetColumn = overId as ColumnId
    } else {
      const overCard = items.find((i) => i.id === overId)
      if (overCard) targetColumn = overCard.column
    }

    if (!targetColumn) return

    setItems((prev) =>
      prev.map((item) =>
        item.id === String(active.id) ? { ...item, column: targetColumn } : item,
      ),
    )
  }

  function upsert(item: Assessment) {
    setItems((prev) => {
      const exists = prev.some((p) => p.id === item.id)
      return exists ? prev.map((p) => (p.id === item.id ? item : p)) : [item, ...prev]
    })
    setEditing(null)
    setCreating(false)
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((p) => p.id !== id))
    setEditing(null)
  }

  function resetDemo() {
    if (!confirm('Сбросить до демо-данных?')) return
    setItems(SEED)
  }

  const stats = useMemo(() => {
    const open = items.filter((i) => i.column !== 'done')
    const ideal = open.filter((i) => getMatchKind(i, items) === 'ideal').length
    const professor = open.filter(
      (i) => getMatchKind(i, items) === 'professor',
    ).length
    return { open: open.length, ideal, professor, done: items.length - open.length }
  }, [items])

  const statusLabel =
    syncStatus === 'shared'
      ? 'общая доска · онлайн'
      : syncStatus === 'connecting'
        ? 'подключение…'
        : syncStatus === 'error'
          ? 'ошибка синка'
          : 'локально · только этот браузер'

  return (
    <div className="app">
      <div className="glow" aria-hidden />
      <header className="top">
        <div className="brand">
          <p className="brand__mark">академ-разница</p>
          <h1>Канбан сдач</h1>
          <p className="brand__lead">
            D и M закрывают разницу. Ищем пересечения: один предмет и один
            преподаватель — лучше сдавать вместе.
          </p>
          <p className={`sync-badge sync-badge--${syncStatus}`}>{statusLabel}</p>
        </div>

        <div className="top__side">
          <div className="stats" aria-label="Сводка">
            <div>
              <strong>{stats.open}</strong>
              <span>открыто</span>
            </div>
            <div>
              <strong>{stats.ideal}</strong>
              <span>идеальных</span>
            </div>
            <div>
              <strong>{stats.professor}</strong>
              <span>общий преп.</span>
            </div>
            <div>
              <strong>{stats.done}</strong>
              <span>done</span>
            </div>
          </div>

          <div className="toolbar">
            <div className="filters" role="group" aria-label="Фильтр совпадений">
              <button
                className={filter === 'all' ? 'chip chip--on' : 'chip'}
                onClick={() => setFilter('all')}
                type="button"
              >
                все
              </button>
              <button
                className={filter === 'ideal' ? 'chip chip--on' : 'chip'}
                onClick={() => setFilter('ideal')}
                type="button"
              >
                идеал
              </button>
              <button
                className={filter === 'professor' ? 'chip chip--on' : 'chip'}
                onClick={() => setFilter('professor')}
                type="button"
              >
                общий преп.
              </button>
            </div>
            <button className="btn btn--ghost" type="button" onClick={resetDemo}>
              демо
            </button>
            <button
              className="btn btn--primary"
              type="button"
              onClick={() => setCreating(true)}
            >
              + карточка
            </button>
          </div>
        </div>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="board">
          {COLUMNS.map((col) => (
            <Column
              key={col.id}
              id={col.id}
              title={col.title}
              subtitle={col.subtitle}
              count={byColumn(col.id).length}
            >
              {byColumn(col.id).map((item) => (
                <Card
                  key={item.id}
                  item={item}
                  match={
                    item.column === 'done' ? 'none' : getMatchKind(item, items)
                  }
                  onEdit={setEditing}
                />
              ))}
            </Column>
          ))}
        </div>

        <DragOverlay>
          {activeItem ? (
            <Card
              item={activeItem}
              match={getMatchKind(activeItem, items)}
              onEdit={() => {}}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <p className="hint">
        Перетаскивай карточки · двойной клик — редактировать
        {shared
          ? ' · изменения видны всем сразу'
          : ' · пока локально (нужен Firebase)'}
      </p>

      {(creating || editing) && (
        <CardForm
          initial={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSave={upsert}
          onDelete={editing ? remove : undefined}
        />
      )}
    </div>
  )
}
