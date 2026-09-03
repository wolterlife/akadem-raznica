import { get, ref, set } from 'firebase/database'
import { getDb } from '../../firebase'
import type { Owner } from '../../types'

const PACE_PATH = 'pace'
const PACE_KEY = 'akadem-raznica:pace'

export interface PersonPace {
  due: string
  startedAt: string
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
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function hasRange(person: PersonPace | null): person is PersonPace {
  return Boolean(person && isDay(person.startedAt) && isDay(person.due))
}

function parsePerson(val: unknown): PersonPace | null {
  if (!val || typeof val !== 'object') return null
  const rec = val as Record<string, unknown>
  const due = isDay(rec.due) ? rec.due : ''
  const startedAt = isDay(rec.startedAt) ? rec.startedAt : ''
  if (!due && !startedAt) return null
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

export function setPersonDates(
  prev: PaceState,
  owner: Owner,
  patch: { startedAt?: string | null; due?: string | null },
  left: number,
  today: string,
): PaceState {
  const cur = prev[owner]
  const startedAt =
    patch.startedAt !== undefined ? patch.startedAt : (cur?.startedAt ?? null)
  const due = patch.due !== undefined ? patch.due : (cur?.due ?? null)
  if (!startedAt && !due) return { ...prev, [owner]: null }

  const started = startedAt && isDay(startedAt) ? startedAt : ''
  const dueDay = due && isDay(due) ? due : ''
  const begun = Boolean(started && diffDays(started, today) >= 0)
  const samples = { ...(cur?.samples ?? {}) }
  if (begun) samples[today] = left

  return {
    ...prev,
    [owner]: {
      startedAt: started,
      due: dueDay,
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
    const startedAt = localP?.startedAt || remoteP?.startedAt || ''
    const due = localP?.due || remoteP?.due || ''
    if (!startedAt && !due) {
      merged[owner] = null
      continue
    }
    const localNewer = (localP?.updatedAt ?? 0) >= (remoteP?.updatedAt ?? 0)
    const dates = localNewer ? localP : remoteP
    const begun =
      isDay(dates?.startedAt || startedAt) &&
      diffDays(dates?.startedAt || startedAt, today) >= 0
    const samples: Record<string, number> = {
      ...remoteP?.samples,
      ...localP?.samples,
    }
    if (begun) samples[today] = remaining[owner]
    merged[owner] = {
      due: dates?.due || due,
      startedAt: dates?.startedAt || startedAt,
      samples,
      updatedAt: dates?.updatedAt,
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
