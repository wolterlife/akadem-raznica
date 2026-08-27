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

export type LinkReason = 'subject' | 'professor' | 'shared'

export function getRelatedLinks(
  card: Assessment,
  all: Assessment[],
): Map<string, LinkReason[]> {
  const map = new Map<string, LinkReason[]>()
  map.set(card.id, [])

  const subj = normalize(card.subject)
  const prof = profKey(card.professor)

  for (const other of all) {
    if (other.id === card.id) continue
    const reasons: LinkReason[] = []
    const sameSubject = normalize(other.subject) === subj
    if (sameSubject) {
      reasons.push('subject')
      const otherBoth =
        other.owners.includes('D') && other.owners.includes('M')
      const selfBoth = card.owners.includes('D') && card.owners.includes('M')
      // личная карточка ↔ общая по тому же предмету (ООПэ ↔ ООП)
      if (otherBoth !== selfBoth) reasons.push('shared')
    }
    const otherProf = profKey(other.professor)
    if (prof && otherProf && prof === otherProf) reasons.push('professor')
    if (reasons.length) map.set(other.id, reasons)
  }

  const focusReasons: LinkReason[] = []
  for (const [id, reasons] of map) {
    if (id === card.id) continue
    for (const r of reasons) {
      if (!focusReasons.includes(r)) focusReasons.push(r)
    }
  }
  map.set(card.id, focusReasons)

  return map
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
