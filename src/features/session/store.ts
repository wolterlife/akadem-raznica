import { get, ref, set } from 'firebase/database'
import { getDb } from '../../firebase'

/** Только D (Бобрик Д.В., ЗИт-3в) */
const SESSION_PATH = 'session/D'
const SESSION_KEY = 'akadem-raznica:session:v1'

export type ExamStatus = 'prep' | 'admitted' | 'passed'

export const STATUS_LABEL: Record<ExamStatus, string> = {
  prep: 'in progress',
  admitted: 'допущен',
  passed: 'сдал',
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
  /** До какой версии SEED_HINTS запись уже дополнена */
  seedV?: number
}

export type SessionState = Record<string, ExamProgress>

export function emptyProgress(): ExamProgress {
  return { format: '', labs: [], materials: '', status: 'prep', grade: '', updatedAt: 0 }
}

/** Стартовые данные (TG группы, 16.10). Версию поднимать при изменении. */
export const SEED_VERSION = 4

const lab = (id: string, text: string, done = false): CheckItem => ({ id, text, done })

export const SEED_HINTS: Record<string, Partial<ExamProgress>> = {
  'Средства и технологии анализа и разработки информационных систем': {
    format:
      'Письменно: ответ на вопрос из билета + построить 1 из 3 диаграмм (Use-case, Class, Activity); может попасться диаграмма сайта (сайт дадут подсмотреть). Рассказывать не нужно.',
    materials:
      'Билеты Стрис.doc (TG, тема СиТАиРИС); 1 Use-case.txt, 2 Class.txt, 3 Activity.txt, Процессы проектирования.docx',
    labs: [
      lab('sitaris-1', 'Диаграмма 1', true),
      lab('sitaris-2', 'Диаграмма 2', true),
      lab('sitaris-3', 'Классовая диаграмма (ID на связях)'),
    ],
  },
  'Компьютерные сети': {
    format:
      'Тянем билет → отвечаем на вопрос. На минимальную оценку надо прийти; автоматы не обещали, возможна беседа по вопросу.',
    materials:
      'Вопросы — блоки после каждой темы в «Конспект лекций КС 2026 в2_5.pdf» (СДО); МУ КС ЛР.pdf; материалы Бизюка',
    labs: [
      lab('ks-1', 'ЛР1', true),
      lab('ks-2', 'ЛР2', true),
      lab('ks-3', 'ЛР3'),
      lab('ks-4', 'ЛР4 (VLAN)'),
      lab('ks-8', 'ЛР8 (Wi-Fi)'),
    ],
  },
  'Высокоуровневые языки программирования': {
    materials: 'Лекции в СДО; инфы об экзамене пока нет',
  },
  'Современные технологии серверной разработки': {
    format:
      'На экзамене Казаков даёт проект → сделать/доделать → отправить ему → защитить (разговор).',
    materials: 'СДО: «Современные средства разработки серверных приложений»',
  },
  'Компьютерные системы конечноэлементных расчетов': {
    materials:
      'Курсовой до 04.11, записать на диск (CD); темы курсового — TG, тема КСКР (12.02); лабы, делавшиеся на парах — Google Drive из темы КСКР\n' +
      'Курсовой сдавать Дуниной на её лабах, ауд. 221: вт 9:50–11:00, чт 9:50–11:00, пт 9:50–13:15 и 14:00–15:00 (Минск). Срок до 04.11.\n' +
      'Пояснительная записка курсового — минимум 25 стр.',
    labs: [
      lab('ksker-3', 'ЛР3 МНК'),
      lab('ksker-4', 'ЛР4 Рунге-Кутта'),
      lab('ksker-arr', 'ЛР массивы (л_р_11_массивы.pdf, показать до конца сессии)'),
      lab('ksker-cw', 'Курсовой'),
    ],
  },
}

function mergeText(user: string, seed?: string) {
  if (!seed) return user
  if (!user.trim()) return seed
  const missing = seed.split('\n').filter((line) => line.trim() && !user.includes(line))
  return missing.length ? `${user}\n${missing.join('\n')}` : user
}

const norm = (t: string) => t.trim().toLowerCase()

/** Правки чек-листов в уже сохранённых записях: версия → предмет → правка. */
const LAB_MIGRATIONS: Record<number, Record<string, (labs: CheckItem[]) => CheckItem[]>> = {
  4: {
    'Компьютерные сети': (labs) =>
      labs
        .filter((l) => l.id !== 'ks-7' && norm(l.text) !== norm('ЛР7 (DHCP)'))
        .map((l) =>
          ['ks-1', 'ks-2'].includes(l.id) || ['лр1', 'лр2'].includes(norm(l.text))
            ? { ...l, done: true }
            : l,
        ),
  },
}

/** Дописывает стартовые данные в уже сохранённую запись, не трогая введённое. */
export function applySeed(title: string, p: ExamProgress): ExamProgress {
  if ((p.seedV ?? 0) >= SEED_VERSION) return p
  const seed = SEED_HINTS[title] ?? {}
  let labs = p.labs
  for (const [v, byTitle] of Object.entries(LAB_MIGRATIONS)) {
    const fix = byTitle[title]
    if (fix && (p.seedV ?? 0) < Number(v)) labs = fix(labs)
  }
  p = { ...p, labs }
  const have = new Set(p.labs.map((l) => l.text.trim().toLowerCase()))
  const haveIds = new Set(p.labs.map((l) => l.id))
  const extra = (seed.labs ?? []).filter(
    (l) => !haveIds.has(l.id) && !have.has(l.text.trim().toLowerCase()),
  )
  return {
    ...p,
    format: mergeText(p.format, seed.format),
    materials: mergeText(p.materials, seed.materials),
    labs: [...p.labs, ...extra],
    seedV: SEED_VERSION,
  }
}

/** Старые значения (готовлюсь / не сдал) → in progress */
function normalizeStatus(value: unknown): ExamStatus {
  return value === 'admitted' || value === 'passed' ? value : 'prep'
}

function parse(val: unknown): SessionState {
  if (!val || typeof val !== 'object') return {}
  const out: SessionState = {}
  for (const [key, raw] of Object.entries(val as Record<string, Partial<ExamProgress>>)) {
    out[key] = {
      ...emptyProgress(),
      ...raw,
      labs: Array.isArray(raw?.labs) ? raw.labs : [],
      status: normalizeStatus(raw?.status),
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
