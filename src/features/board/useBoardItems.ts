import { useCallback, useEffect, useRef, useState } from 'react'
import { SEED } from '../../data'
import {
  PULL_INTERVAL_MS,
  boardsEqual,
  isSyncConfigured,
  loadLocal,
  pullBoard,
  pushBoard,
  saveLocal,
  type SyncStatus,
} from '../../sync'
import type { Assessment, ColumnId } from '../../types'
import { applyMove } from './progress'

export function useBoardItems() {
  const shared = isSyncConfigured()
  const [items, setItems] = useState<Assessment[]>(() =>
    shared ? [] : loadLocal(SEED),
  )
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    shared ? 'connecting' : 'local',
  )
  const [refreshing, setRefreshing] = useState(false)

  const readyRef = useRef(!shared)
  const skipPushRef = useRef(false)
  const itemsRef = useRef(items)
  itemsRef.current = items

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
    } catch (err) {
      console.error('[sync] refresh failed', err)
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
      } catch (err) {
        console.error('[sync] initial pull failed', err)
        if (!cancelled) setSyncStatus('error')
      }
    })()

    const id = window.setInterval(() => {
      void applyRemote(false).catch((err) => {
        console.error('[sync] pull failed', err)
        setSyncStatus('error')
      })
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
      void pushBoard(items).catch((err) => {
        console.error('[sync] push failed', err)
        setSyncStatus('error')
      })
    }, 200)
    return () => window.clearTimeout(t)
  }, [items, shared])

  function moveToColumn(id: string, column: ColumnId, fromColumn?: ColumnId) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? applyMove(item, column, fromColumn) : item,
      ),
    )
  }

  function upsert(item: Assessment) {
    setItems((prev) => {
      const exists = prev.some((p) => p.id === item.id)
      return exists
        ? prev.map((p) => (p.id === item.id ? item : p))
        : [item, ...prev]
    })
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((p) => p.id !== id))
  }

  function resetDemo() {
    if (!confirm('Сбросить до демо-данных?')) return
    setItems(SEED)
  }

  return {
    shared,
    items,
    syncStatus,
    refreshing,
    refreshFromDb,
    moveToColumn,
    upsert,
    remove,
    resetDemo,
  }
}
