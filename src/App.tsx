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
  PULL_INTERVAL_MS,
  boardsEqual,
  getMatchKind,
  isSyncConfigured,
  loadLocal,
  pullBoard,
  pushBoard,
  saveLocal,
  type SyncStatus,
} from './sync'
import {
  clearIdentity,
  loadIdentity,
  setPresenceEditing,
  startPresence,
  type Identity,
  type PresenceUser,
} from './presence'
import type { Assessment, ColumnId } from './types'
import { Card, Column } from './components/BoardParts'
import { CardForm } from './components/CardForm'
import { NameGate } from './components/NameGate'
import './App.css'

export default function App() {
  const shared = isSyncConfigured()
  const [identity, setIdentity] = useState<Identity | null>(() =>
    shared ? loadIdentity() : null,
  )
  const [online, setOnline] = useState<PresenceUser[]>([])
  const [items, setItems] = useState<Assessment[]>(() =>
    shared ? [] : loadLocal(SEED),
  )
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    shared ? 'connecting' : 'local',
  )
  const [refreshing, setRefreshing] = useState(false)
  const [editing, setEditing] = useState<Assessment | null>(null)
  const [creating, setCreating] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'ideal' | 'professor'>('all')
  const readyRef = useRef(!shared)
  const skipPushRef = useRef(false)
  const itemsRef = useRef(items)
  itemsRef.current = items

  useEffect(() => {
    if (!shared || !identity) {
      setOnline([])
      return
    }
    return startPresence(identity, setOnline)
  }, [shared, identity])

  useEffect(() => {
    if (!shared) return
    if (editing) setPresenceEditing(editing.id)
    else setPresenceEditing(null)
  }, [shared, editing])

  const applyRemote = useCallback(async (seedIfEmpty: boolean) => {
    const remote = await pullBoard()
    skipPushRef.current = true
    if (remote == null) {
      if (seedIfEmpty) {
        setItems(SEED)
        await pushBoard(SEED)
      }
    } else if (!boardsEqual(remote, itemsRef.current)) {
      setItems(remote)
    } else {
      skipPushRef.current = false
    }
    readyRef.current = true
    setSyncStatus('shared')
  }, [])

  const refreshFromDb = useCallback(async () => {
    if (!shared) return
    setRefreshing(true)
    try {
      await applyRemote(false)
    } catch {
      setSyncStatus('error')
    } finally {
      setRefreshing(false)
    }
  }, [shared, applyRemote])

  useEffect(() => {
    if (!shared) return

    let cancelled = false
    void (async () => {
      try {
        if (!cancelled) await applyRemote(true)
      } catch {
        if (!cancelled) setSyncStatus('error')
      }
    })()

    const id = window.setInterval(() => {
      void applyRemote(false).catch(() => setSyncStatus('error'))
    }, PULL_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [shared, applyRemote])

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

  function renameSelf() {
    clearIdentity()
    setIdentity(null)
    setOnline([])
  }

  const editorsByCard = useMemo(() => {
    const map = new Map<string, PresenceUser[]>()
    for (const u of online) {
      if (!u.editingId || u.id === identity?.id) continue
      const list = map.get(u.editingId) ?? []
      list.push(u)
      map.set(u.editingId, list)
    }
    return map
  }, [online, identity?.id])

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
      ? 'общая доска · pull 15с'
      : syncStatus === 'connecting'
        ? 'подключение…'
        : syncStatus === 'error'
          ? 'ошибка синка'
          : 'локально · только этот браузер'

  return (
    <div className="app">
      {shared && !identity && <NameGate onReady={setIdentity} />}
      <div className="glow" aria-hidden />
      <header className="top">
        <div className="brand">
          <p className="brand__mark">академ-разница</p>
          <h1>Канбан сдач</h1>
          <p className="brand__lead">
            D и M закрывают разницу. Ищем пересечения: один предмет и одна
            кафедра — лучше сдавать вместе.
          </p>
          <p className={`sync-badge sync-badge--${syncStatus}`}>{statusLabel}</p>
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
                  <span className="online__dot">{u.name.slice(0, 1).toUpperCase()}</span>
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
              <span>идеальных</span>
            </div>
            <div>
              <strong>{stats.professor}</strong>
              <span>общая каф.</span>
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
                общая каф.
              </button>
            </div>
            <button className="btn btn--ghost" type="button" onClick={resetDemo}>
              демо
            </button>
            {shared && identity && (
              <button
                className="btn btn--ghost btn--me"
                type="button"
                onClick={renameSelf}
                title="Сменить имя"
                style={{ ['--u' as string]: identity.color }}
              >
                <span className="online__dot">{identity.name.slice(0, 1).toUpperCase()}</span>
                {identity.name}
              </button>
            )}
            {shared && (
              <button
                className={`btn btn--ghost btn--refresh ${refreshing ? 'is-loading' : ''}`}
                type="button"
                onClick={() => void refreshFromDb()}
                disabled={refreshing}
                title="Обновить с сервера"
              >
                <span className="spin" aria-hidden>
                  ↻
                </span>
                refresh
              </button>
            )}
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
                  editors={editorsByCard.get(item.id)}
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
        Перетаскивай карточки · карандаш — редактировать
        {shared
          ? ' · синк 15с · онлайн и ✎ на карточке видны другим'
          : ' · пока локально (нужен Firebase)'}
      </p>

      {(creating || editing) && (
        <CardForm
          initial={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
            setPresenceEditing(null)
          }}
          onSave={(item) => {
            upsert(item)
            setPresenceEditing(null)
          }}
          onDelete={
            editing
              ? (id) => {
                  remove(id)
                  setPresenceEditing(null)
                }
              : undefined
          }
        />
      )}
    </div>
  )
}
