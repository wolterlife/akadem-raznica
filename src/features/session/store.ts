import { get, ref, set } from 'firebase/database'
import { getDb } from '../../firebase'

/** Только D (Бобрик Д.В., ЗИт-3в) */
const SESSION_PATH = 'session/D'
const SESSION_KEY = 'akadem-raznica:session:v1'

export type ExamStatus = 'prep' | 'admitted' | 'passed' | 'failed'

export const STATUS_LABEL: Record<ExamStatus, string> = {
  prep: 'готовлюсь',
  admitted: 'допущен',
  passed: 'сдал',
  failed: 'не сдал',
}

export interface CheckItem {
  id: string
  text: string
  done: boolean
}

export interface ExamProgress {
  format: string
  labs: CheckItem[]
  materials: string
  status: ExamStatus
  grade: string
  updatedAt: number
}

export type SessionState = Record<string, ExamProgress>

export function emptyProgress(): ExamProgress {
  return { format: '', labs: [], materials: '', status: 'prep', grade: '', updatedAt: 0 }
}

/** Стартовые данные (что известно на 16.10), пока нет сохранённых. */
export const SEED_HINTS: Record<string, Partial<ExamProgress>> = {
  'Средства и технологии анализа и разработки информационных систем': {
    labs: [
      { id: 'sitaris-1', text: 'Диаграмма 1', done: true },
      { id: 'sitaris-2', text: 'Диаграмма 2', done: true },
      { id: 'sitaris-3', text: 'Классовая диаграмма (ID на связях)', done: false },
    ],
  },
  'Современные технологии серверной разработки': {
    format: 'Проект — показать Казакову',
  },
}

function parse(val: unknown): SessionState {
  if (!val || typeof val !== 'object') return {}
  const out: SessionState = {}
  for (const [key, raw] of Object.entries(val as Record<string, Partial<ExamProgress>>)) {
    out[key] = {
      ...emptyProgress(),
      ...raw,
      labs: Array.isArray(raw?.labs) ? raw.labs : [],
    }
  }
  return out
}

export function loadLocalSession(): SessionState {
  try {
    return parse(JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null'))
  } catch {
    return {}
  }
}

export function saveLocalSession(state: SessionState) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(state))
}

export async function pullSession(): Promise<SessionState | null> {
  const db = getDb()
  if (!db) return null
  const snap = await get(ref(db, SESSION_PATH))
  return parse(snap.val())
}

export async function pushSession(state: SessionState): Promise<void> {
  saveLocalSession(state)
  const db = getDb()
  if (!db) return
  await set(ref(db, SESSION_PATH), state)
}

/** По каждому экзамену побеждает более свежая правка. */
export function mergeSession(a: SessionState, b: SessionState): SessionState {
  const out: SessionState = { ...a }
  for (const [key, val] of Object.entries(b)) {
    if (!out[key] || val.updatedAt > out[key].updatedAt) out[key] = val
  }
  return out
}
