import { onValue, ref, set, type Unsubscribe } from 'firebase/database'
import { getDb, isSyncConfigured } from './firebase'
import type { Assessment } from './types'

const BOARD_PATH = 'board'
const STORAGE_KEY = 'akadem-raznica:v1'

export type SyncStatus = 'shared' | 'local' | 'connecting' | 'error'

interface BoardPayload {
  items: Assessment[]
  updatedAt: number
}

export function loadLocal(fallback: Assessment[]): Assessment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Assessment[]
    return Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

export function saveLocal(items: Assessment[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function subscribeBoard(
  onData: (items: Assessment[] | null) => void,
  onError: (message: string) => void,
): Unsubscribe | null {
  const db = getDb()
  if (!db) return null

  const boardRef = ref(db, BOARD_PATH)
  return onValue(
    boardRef,
    (snap) => {
      const val = snap.val() as BoardPayload | Assessment[] | null
      if (val == null) {
        onData(null)
        return
      }
      if (Array.isArray(val)) {
        onData(val)
        return
      }
      if (Array.isArray(val.items)) {
        onData(val.items)
        return
      }
      onData(null)
    },
    (err) => onError(err.message),
  )
}

export async function pushBoard(items: Assessment[]): Promise<void> {
  const db = getDb()
  if (!db) {
    saveLocal(items)
    return
  }
  await set(ref(db, BOARD_PATH), {
    items,
    updatedAt: Date.now(),
  } satisfies BoardPayload)
}

export { isSyncConfigured }

/**
 * ideal — оба студента, один предмет и (обычно) один препод
 * professor — разные предметы, но общий преподаватель
 */
export function getMatchKind(
  card: Assessment,
  all: Assessment[],
): import('./types').MatchKind {
  if (card.owners.includes('D') && card.owners.includes('M')) {
    return 'ideal'
  }

  const others = all.filter((a) => a.id !== card.id && a.column !== 'done')
  const subj = normalize(card.subject)
  const prof = normalize(card.professor)

  const idealPair = others.some((a) => {
    const coversBoth =
      new Set([...card.owners, ...a.owners]).has('D') &&
      new Set([...card.owners, ...a.owners]).has('M')
    return (
      coversBoth &&
      normalize(a.subject) === subj &&
      normalize(a.professor) === prof
    )
  })
  if (idealPair) return 'ideal'

  const professorPair = others.some((a) => {
    const coversBoth =
      new Set([...card.owners, ...a.owners]).has('D') &&
      new Set([...card.owners, ...a.owners]).has('M')
    return (
      coversBoth &&
      normalize(a.professor) === prof &&
      normalize(a.subject) !== subj
    )
  })
  if (professorPair) return 'professor'

  return 'none'
}

function normalize(value: string) {
  return value.trim().toLowerCase()
}

export function uid() {
  return crypto.randomUUID()
}
