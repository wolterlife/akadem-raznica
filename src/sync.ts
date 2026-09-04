import { get, ref, set } from 'firebase/database'
import { getDb, isSyncConfigured } from './firebase'
import { doneOwnersOf, isFullyDone, isPendingDone } from './features/board/progress'
import { isUnknownProfessor } from './professors'
import type { Assessment, Owner } from './types'

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
  let items: Assessment[] | null = null
  if (Array.isArray(val)) items = val as Assessment[]
  else if (
    typeof val === 'object' &&
    Array.isArray((val as BoardPayload).items)
  ) {
    items = (val as BoardPayload).items
  }
  return items ? normalizeBoard(items) : null
}

/** Legacy column `shared` → personal column (keep D+M owners). */
export function normalizeBoard(items: Assessment[]): Assessment[] {
  return items.map((item) => {
    const next: Assessment = { ...item }
    if ((next.column as string) === 'shared') next.column = 'd'
    if (next.column === 'done' && (!next.doneBy || next.doneBy.length === 0)) {
      next.doneBy = [...next.owners]
    } else if (next.doneBy) {
      next.doneBy = doneOwnersOf(next)
    }
    if (next.note && !next.notes) {
      const notes: NonNullable<Assessment['notes']> = {}
      for (const owner of next.owners) notes[owner] = next.note
      next.notes = notes
    }
    return next
  })
}

export function loadLocal(fallback: Assessment[]): Assessment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Assessment[]
    return Array.isArray(parsed) ? normalizeBoard(parsed) : fallback
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

/** Firebase RTDB throws if any nested field is `undefined`. */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as T
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value)) {
      if (nested === undefined) continue
      out[key] = stripUndefined(nested)
    }
    return out as T
  }
  return value
}

export async function pushBoard(items: Assessment[]): Promise<void> {
  const db = getDb()
  if (!db) {
    saveLocal(items)
    return
  }
  await set(
    ref(db, BOARD_PATH),
    stripUndefined({
      items,
      updatedAt: Date.now(),
    } satisfies BoardPayload),
  )
}

export function boardsEqual(a: Assessment[], b: Assessment[]) {
  return JSON.stringify(a) === JSON.stringify(b)
}

export { isSyncConfigured }

/**
 * ideal — полное совпадение: предмет + тип + препод (или одна карточка D+M)
 * alike — тот же предмет и препод, но другой тип сдачи
 * subject — один предмет, разные преподы
 * professor — разные предметы, общий преподаватель
 */
export function getMatchKind(
  card: Assessment,
  all: Assessment[],
): import('./types').MatchKind {
  if (isPendingDone(card)) return 'none'
  if (card.owners.includes('D') && card.owners.includes('M')) {
    return 'ideal'
  }

  const others = all.filter((a) => a.id !== card.id && !isPendingDone(a))
  const subj = normalize(card.subject)
  const prof = profKey(card.professor)

  const subjectPeers = others.filter((a) => {
    const coversBoth =
      new Set([...card.owners, ...a.owners]).has('D') &&
      new Set([...card.owners, ...a.owners]).has('M')
    return coversBoth && normalize(a.subject) === subj
  })

  if (subjectPeers.length) {
    if (prof) {
      const perfect = subjectPeers.some(
        (a) => a.type === card.type && profKey(a.professor) === prof,
      )
      if (perfect) return 'ideal'

      const alike = subjectPeers.some((a) => profKey(a.professor) === prof)
      if (alike) return 'alike'
    }
    return 'subject'
  }

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
/** Кто из пары уже закрыл тот же предмет своей карточкой. */
export function closedCounterpart(
  card: Assessment,
  all: Assessment[],
): Owner | null {
  if (isFullyDone(card)) return null
  const who = card.owners.length === 1 ? card.owners[0] : null
  if (!who) return null
  const other: Owner = who === 'D' ? 'M' : 'D'
  const subj = normalize(card.subject)
  const found = all.some(
    (a) =>
      a.id !== card.id &&
      isFullyDone(a) &&
      !isPendingDone(a) &&
      a.owners.includes(other) &&
      !a.owners.includes(who) &&
      normalize(a.subject) === subj,
  )
  return found ? other : null
}

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

export function normalize(value: string) {
  return value.trim().toLowerCase()
}

export function profKey(value: string) {
  if (isUnknownProfessor(value)) return null
  return normalize(value) || null
}

export function uid() {
  return crypto.randomUUID()
}
