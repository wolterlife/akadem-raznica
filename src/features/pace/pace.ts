import { get, ref, set } from 'firebase/database'
import { getDb } from '../../firebase'
import type { Owner } from '../../types'

const PACE_PATH = 'pace'
const PACE_KEY = 'akadem-raznica:pace'

export interface PaceSession {
  /** Stable row id so date inputs keep focus while typing. */
  id: string
  start: string
  end: string
}

export interface PersonPace {
  due: string
  startedAt: string
  /** Exam session windows — shaded on the chart. */
  sessions: PaceSession[]
  samples: Record<string, number>
  updatedAt?: number
}

export type PaceState = Record<Owner, PersonPace | null>

export function todayKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseDay(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y!, (m ?? 1) - 1, d ?? 1)
}

export function diffDays(from: string, to: string) {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86_400_000)
}

export function addDays(from: string, days: number) {
  const d = parseDay(from)
  d.setDate(d.getDate() + days)
  return todayKey(d)
}

export function formatDay(key: string) {
  return parseDay(key).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  })
}

export function pacesEqual(a: PaceState, b: PaceState) {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function emptyPace(): PaceState {
  return { D: null, M: null }
}

export function loadLocalPace(): PaceState {
  try {
    const raw = localStorage.getItem(PACE_KEY)
    if (!raw) return emptyPace()
    return parsePace(JSON.parse(raw))
  } catch {
    return emptyPace()
  }
}

export function saveLocalPace(pace: PaceState) {
  try {
    localStorage.setItem(PACE_KEY, JSON.stringify(pace))
  } catch {
    /* ignore */
  }
}

function isDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const year = Number(value.slice(0, 4))
  // Reject browser glitches like 0002-10-14 while typing the year.
  return year >= 2000 && year <= 2100
}

export function newSessionId() {
  return crypto.randomUUID()
}

export function emptySession(): PaceSession {
  return { id: newSessionId(), start: '', end: '' }
}

function parseSessionRow(val: unknown, index: number): PaceSession | null {
  if (!val || typeof val !== 'object') return null
  const rec = val as Record<string, unknown>
  const start = isDay(rec.start) ? rec.start : ''
  const end = isDay(rec.end) ? rec.end : ''
  const storedId = typeof rec.id === 'string' ? rec.id.trim() : ''
  const id = storedId || `row-${index}-${start}-${end}`
  if (!start && !end && !storedId) return null
  return { id, start, end }
}

/** Normalize stored sessions; migrates legacy sessionStart/sessionEnd. */
export function normalizeSessions(
  raw: unknown,
  legacyStart?: unknown,
  legacyEnd?: unknown,
): PaceSession[] {
  const out: PaceSession[] = []
  if (Array.isArray(raw)) {
    raw.forEach((item, index) => {
      const row = parseSessionRow(item, index)
      if (row) out.push(row)
    })
  } else if (raw && typeof raw === 'object') {
    // Firebase may store dense arrays as objects { "0": {...} }
    Object.values(raw as Record<string, unknown>).forEach((item, index) => {
      const row = parseSessionRow(item, index)
      if (row) out.push(row)
    })
  }
  if (
    out.length === 0 &&
    isDay(legacyStart) &&
    isDay(legacyEnd) &&
    diffDays(legacyStart, legacyEnd) >= 0
  ) {
    out.push({
      id: `legacy-${legacyStart}-${legacyEnd}`,
      start: legacyStart,
      end: legacyEnd,
    })
  }
  return out
}

/** Keep user-edited rows, including incomplete drafts. */
export function sanitizeSessions(list: PaceSession[]): PaceSession[] {
  return list.map((s) => ({
    id: s.id?.trim() ? s.id : newSessionId(),
    start: isDay(s.start) ? s.start : '',
    end: isDay(s.end) ? s.end : '',
  }))
}

/** Sessions with both ends set and start ≤ end — drawn on the chart. */
export function completeSessions(sessions: PaceSession[]): PaceSession[] {
  return sessions.filter(
    (s) => isDay(s.start) && isDay(s.end) && diffDays(s.start, s.end) >= 0,
  )
}

export function dateInSessions(date: string, sessions: PaceSession[]): boolean {
  return completeSessions(sessions).some(
    (s) => diffDays(s.start, date) >= 0 && diffDays(date, s.end) >= 0,
  )
}

export function hasRange(person: PersonPace | null): person is PersonPace {
  return Boolean(person && isDay(person.startedAt) && isDay(person.due))
}

/** Display-only: remaining as if «под вопросом» cards were never on the board. */
export function personWithoutPending(
  person: PersonPace,
  pendingLeft: number,
  total: number,
): PersonPace {
  const samples: Record<string, number> = {}
  for (const [date, left] of Object.entries(person.samples)) {
    samples[date] = Math.min(total, Math.max(0, left - pendingLeft))
  }
  return { ...person, samples }
}

function parsePerson(val: unknown): PersonPace | null {
  if (!val || typeof val !== 'object') return null
  const rec = val as Record<string, unknown>
  const due = isDay(rec.due) ? rec.due : ''
  const startedAt = isDay(rec.startedAt) ? rec.startedAt : ''
  const sessions = normalizeSessions(
    rec.sessions,
    rec.sessionStart,
    rec.sessionEnd,
  )
  if (!due && !startedAt && sessions.length === 0) return null
  const samples: Record<string, number> = {}
  if (rec.samples && typeof rec.samples === 'object') {
    for (const [key, left] of Object.entries(rec.samples as Record<string, unknown>)) {
      if (isDay(key) && typeof left === 'number' && Number.isFinite(left)) {
        samples[key] = Math.max(0, Math.round(left))
      }
    }
  }
  return {
    due,
    startedAt,
    sessions,
    samples,
    updatedAt: typeof rec.updatedAt === 'number' ? rec.updatedAt : undefined,
  }
}

export function parsePace(val: unknown): PaceState {
  if (!val || typeof val !== 'object') return emptyPace()
  const rec = val as Record<string, unknown>
  return {
    D: parsePerson(rec.D),
    M: parsePerson(rec.M),
  }
}

export async function pullPace(): Promise<PaceState | null> {
  const db = getDb()
  if (!db) return null
  const snap = await get(ref(db, PACE_PATH))
  if (!snap.exists()) return emptyPace()
  return parsePace(snap.val())
}

export async function pushPace(pace: PaceState): Promise<void> {
  const db = getDb()
  if (!db) {
    saveLocalPace(pace)
    return
  }
  await set(ref(db, PACE_PATH), {
    D: pace.D,
    M: pace.M,
  })
}

export type PersonDatePatch = {
  startedAt?: string | null
  due?: string | null
  sessions?: PaceSession[]
}

function dayOrEmpty(value: string | null | undefined, fallback: string) {
  if (value === undefined) return fallback
  if (value === null || value === '') return ''
  return isDay(value) ? value : fallback
}

export function setPersonDates(
  prev: PaceState,
  owner: Owner,
  patch: PersonDatePatch,
  left: number,
  today: string,
): PaceState {
  const cur = prev[owner]
  const startedAt = dayOrEmpty(patch.startedAt, cur?.startedAt ?? '')
  const due = dayOrEmpty(patch.due, cur?.due ?? '')
  const sessions =
    patch.sessions !== undefined
      ? sanitizeSessions(patch.sessions)
      : (cur?.sessions ?? [])

  if (!startedAt && !due && sessions.length === 0) {
    return { ...prev, [owner]: null }
  }

  const begun = Boolean(startedAt && diffDays(startedAt, today) >= 0)
  const samples = { ...(cur?.samples ?? {}) }
  if (begun) samples[today] = left

  return {
    ...prev,
    [owner]: {
      startedAt,
      due,
      sessions,
      samples,
      updatedAt: Date.now(),
    },
  }
}

export function stampSamples(
  prev: PaceState,
  remaining: Record<Owner, number>,
  today: string,
): PaceState {
  let changed = false
  const next: PaceState = { D: prev.D, M: prev.M }
  for (const owner of ['D', 'M'] as const) {
    const person = next[owner]
    if (!person || !isDay(person.startedAt)) continue
    if (diffDays(person.startedAt, today) < 0) continue
    const left = remaining[owner]
    if (person.samples[today] === left) continue
    next[owner] = {
      ...person,
      samples: { ...person.samples, [today]: left },
    }
    changed = true
  }
  return changed ? next : prev
}

export function hasPaceData(pace: PaceState | null | undefined): boolean {
  if (!pace) return false
  for (const owner of ['D', 'M'] as const) {
    const p = pace[owner]
    if (!p) continue
    if (isDay(p.startedAt) || isDay(p.due)) return true
    if (p.sessions.some((s) => s.start || s.end)) return true
  }
  return false
}

export function mergePace(
  remote: PaceState | null,
  local: PaceState,
  remaining: Record<Owner, number>,
  today: string,
): PaceState {
  const source = remote ?? emptyPace()
  const merged = emptyPace()
  for (const owner of ['D', 'M'] as const) {
    const remoteP = source[owner]
    const localP = local[owner]
    if (!localP && !remoteP) {
      merged[owner] = null
      continue
    }
    // Prefer remote when this device has no person yet (fresh phone).
    const localNewer =
      localP != null &&
      (localP.updatedAt ?? 0) >= (remoteP?.updatedAt ?? 0)
    const dates = localNewer ? localP : remoteP ?? localP
    const startedAt = dates?.startedAt || localP?.startedAt || remoteP?.startedAt || ''
    const due = dates?.due || localP?.due || remoteP?.due || ''
    const sessions =
      dates?.sessions?.length
        ? dates.sessions
        : localP?.sessions?.length
          ? localP.sessions
          : (remoteP?.sessions ?? [])
    if (!startedAt && !due && sessions.length === 0) {
      merged[owner] = null
      continue
    }
    const begun = isDay(startedAt) && diffDays(startedAt, today) >= 0
    const samples: Record<string, number> = {
      ...remoteP?.samples,
      ...localP?.samples,
    }
    if (begun) samples[today] = remaining[owner]
    merged[owner] = {
      due,
      startedAt,
      sessions: sanitizeSessions(sessions),
      samples,
      updatedAt: dates?.updatedAt ?? localP?.updatedAt ?? remoteP?.updatedAt,
    }
  }
  return merged
}

export function progressFraction(
  startedAt: string,
  due: string,
  onDate: string,
) {
  if (diffDays(onDate, due) <= 0) return 1
  const span = diffDays(startedAt, due)
  if (span <= 0) return 0
  const elapsed = Math.max(0, diffDays(startedAt, onDate))
  return Math.min(1, elapsed / span)
}

export function idealLeft(
  total: number,
  startedAt: string,
  due: string,
  onDate: string,
) {
  return total * (1 - progressFraction(startedAt, due, onDate))
}

export interface PaceSnapshot {
  done: number
  shouldBeDone: number
  left: number
  idealLeftNow: number
  delta: number
  status: 'setup' | 'waiting' | 'ahead' | 'on' | 'behind' | 'done'
}

export function snapshotFor(
  total: number,
  left: number,
  person: PersonPace,
  today: string,
): PaceSnapshot {
  const done = Math.max(0, total - left)
  if (!hasRange(person)) {
    return {
      done,
      shouldBeDone: 0,
      left,
      idealLeftNow: total,
      delta: 0,
      status: 'setup',
    }
  }
  if (diffDays(person.startedAt, today) < 0) {
    return {
      done,
      shouldBeDone: 0,
      left,
      idealLeftNow: total,
      delta: 0,
      status: 'waiting',
    }
  }
  const idealLeftNow = idealLeft(total, person.startedAt, person.due, today)
  const shouldBeDone = Math.round(total - idealLeftNow)
  const delta = Math.round(idealLeftNow - left)
  let status: PaceSnapshot['status'] = 'on'
  if (left === 0) status = 'done'
  else if (delta >= 1) status = 'ahead'
  else if (delta <= -1) status = 'behind'
  return { done, shouldBeDone, left, idealLeftNow, delta, status }
}
