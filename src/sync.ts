import { get, ref, set } from 'firebase/database'
import { getDb, isSyncConfigured } from './firebase'
import type { Assessment } from './types'

const BOARD_PATH = 'board'
const STORAGE_KEY = 'akadem-raznica:v1'
export const PULL_INTERVAL_MS = 15_000

export type SyncStatus = 'shared' | 'local' | 'connecting' | 'error'

interface BoardPayload {
  items: Assessment[]
  updatedAt: number
}

function parseBoard(val: unknown): Assessment[] | null {
  if (val == null) return null
  if (Array.isArray(val)) return val as Assessment[]
  if (
    typeof val === 'object' &&
    Array.isArray((val as BoardPayload).items)
  ) {
    return (val as BoardPayload).items
  }
  return null
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

/** One-shot pull from Realtime Database */
export async function pullBoard(): Promise<Assessment[] | null> {
  const db = getDb()
  if (!db) return null
  const snap = await get(ref(db, BOARD_PATH))
  return parseBoard(snap.val())
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

export function boardsEqual(a: Assessment[], b: Assessment[]) {
  return JSON.stringify(a) === JSON.stringify(b)
}

export { isSyncConfigured }

/**
 * ideal — оба студента, один предмет (+ желательно один препод)
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
  const prof = profKey(card.professor)

  const idealPair = others.some((a) => {
    const coversBoth =
      new Set([...card.owners, ...a.owners]).has('D') &&
      new Set([...card.owners, ...a.owners]).has('M')
    const otherProf = profKey(a.professor)
    return (
      coversBoth &&
      normalize(a.subject) === subj &&
      (prof == null || otherProf == null || otherProf === prof)
    )
  })
  if (idealPair) return 'ideal'

  if (prof == null) return 'none'

  const professorPair = others.some((a) => {
    const coversBoth =
      new Set([...card.owners, ...a.owners]).has('D') &&
      new Set([...card.owners, ...a.owners]).has('M')
    return (
      coversBoth &&
      profKey(a.professor) === prof &&
      normalize(a.subject) !== subj
    )
  })
  if (professorPair) return 'professor'

  return 'none'
}

/** Группа для сортировки «по связям»: препод → иначе предмет */
export function linkGroupKey(card: Assessment): string {
  const prof = profKey(card.professor)
  if (prof) return `p:${prof}`
  return `s:${normalize(card.subject)}`
}

export function areCardsLinked(a: Assessment, b: Assessment): boolean {
  if (a.id === b.id) return true
  if (normalize(a.subject) === normalize(b.subject)) return true
  const pa = profKey(a.professor)
  const pb = profKey(b.professor)
  if (pa && pb && pa === pb) return true
  return false
}

export function getRelatedIds(card: Assessment, all: Assessment[]): Set<string> {
  const ids = new Set<string>([card.id])
  for (const other of all) {
    if (areCardsLinked(card, other)) ids.add(other.id)
  }
  return ids
}

function normalize(value: string) {
  return value.trim().toLowerCase()
}

function profKey(value: string) {
  const n = normalize(value)
  if (!n || n === '—' || n === '-' || n === '–' || n === '?') return null
  return n
}

export function uid() {
  return crypto.randomUUID()
}
