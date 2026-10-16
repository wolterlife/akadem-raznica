import { PAIR_TIMES } from '../whereabouts/schedule'

export const GROUP_ID = 9337
export const MY_SUBGROUP = '1'
const WARSAW_TZ = 'Europe/Warsaw'
const MINSK_OFFSET_H = 3

export interface SessionLesson {
  date: string
  to: string
  num: number
  off: number
  /** '' — вся группа, иначе номер подгруппы */
  sub: string
  kind: string
  title: string
  teacher: string
  teacherId: number
  frame: number
  room: string
}

export interface SessionBundle {
  fetchedAt: string
  live: boolean
  lessons: SessionLesson[]
}

export interface ExamInfo {
  key: string
  title: string
  date: string
  num: number
  start: string
  end: string
  teacher: string
  room: string
  /** Минск → UTC момент начала */
  startsAt: number
  /** Оставшиеся пары по предмету до экзамена (моя подгруппа + вся группа) */
  before: SessionLesson[]
}

const LIVE_BASE = import.meta.env.DEV
  ? '/vstu-api'
  : 'https://schedule.vstu.by/api/v1'
const CACHE_URL = `${import.meta.env.BASE_URL}vstu-session.json`

function mapRow(r: Record<string, unknown>): SessionLesson | null {
  const num = Number(r.lessonNumber)
  const date = String(r.startDate ?? '')
  if (!num || !date) return null
  const teacher = (r.teacher ?? {}) as Record<string, unknown>
  const sub = r.subGroup && r.subGroup !== 'Все' ? String(r.subGroup) : ''
  return {
    date,
    to: String(r.endDate ?? date),
    num,
    off: Number(r.timeOffset) || 0,
    sub,
    kind: String(r.typeClassName ?? ''),
    title: String(r.disciplineName ?? ''),
    teacher: String(teacher.fullName ?? ''),
    teacherId: Number(teacher.id) || 0,
    frame: Number(r.frame) || 0,
    room: String(r.location ?? ''),
  }
}

export async function loadSessionBundle(): Promise<SessionBundle | null> {
  try {
    const res = await fetch(`${LIVE_BASE}/schedule/group/${GROUP_ID}`)
    if (!res.ok) throw new Error(String(res.status))
    const rows = (await res.json()) as Record<string, unknown>[]
    const lessons = rows.map(mapRow).filter((l): l is SessionLesson => !!l)
    return { fetchedAt: new Date().toISOString(), live: true, lessons }
  } catch {
    try {
      const res = await fetch(CACHE_URL)
      if (!res.ok) return null
      const raw = (await res.json()) as Partial<SessionBundle>
      if (!Array.isArray(raw.lessons)) return null
      return { fetchedAt: String(raw.fetchedAt ?? ''), live: false, lessons: raw.lessons }
    } catch {
      return null
    }
  }
}

export function isExam(l: SessionLesson) {
  return /экзамен/i.test(l.kind)
}

export function isMine(l: SessionLesson) {
  return l.sub === '' || l.sub === MY_SUBGROUP
}

/** Минское время начала пары → timestamp */
export function lessonStart(l: { date: string; num: number; off?: number }) {
  const [h, m] = (PAIR_TIMES[l.num]?.[0] ?? '0:00').split(':').map(Number)
  const [y, mo, d] = l.date.split('-').map(Number)
  return Date.UTC(y, mo - 1, d, h - MINSK_OFFSET_H, m + (l.off || 0))
}

export function warsawTime(ts: number) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: WARSAW_TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(ts)
}

export function fmtDate(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
    timeZone: 'UTC',
  }).format(Date.UTC(y, m - 1, d))
}

export function cabinet(frame: number, room: string) {
  if (!room) return ''
  return frame && frame !== 1 ? `${frame}-${room}` : room
}

export function deriveExams(lessons: SessionLesson[], now = Date.now()): ExamInfo[] {
  const mine = lessons.filter(isMine)
  const byTitle = new Map<string, SessionLesson[]>()
  for (const l of mine.filter(isExam)) {
    const list = byTitle.get(l.title) ?? []
    list.push(l)
    byTitle.set(l.title, list)
  }
  const exams: ExamInfo[] = []
  for (const [title, rows] of byTitle) {
    rows.sort((a, b) => lessonStart(a) - lessonStart(b))
    const first = rows[0]
    const last = rows[rows.length - 1]
    const startsAt = lessonStart(first)
    const before = mine
      .filter(
        (l) =>
          l.title === title &&
          !isExam(l) &&
          lessonStart(l) < startsAt &&
          lessonStart(l) + 95 * 60_000 > now,
      )
      .sort((a, b) => lessonStart(a) - lessonStart(b))
    exams.push({
      key: String(first.title).replace(/[.#$/[\]]/g, '_'),
      title,
      date: first.date,
      num: first.num,
      start: PAIR_TIMES[first.num]?.[0] ?? '',
      end: PAIR_TIMES[last.num]?.[1] ?? '',
      teacher: first.teacher,
      room: cabinet(first.frame, first.room),
      startsAt,
      before,
    })
  }
  return exams.sort((a, b) => a.startsAt - b.startsAt)
}

export function daysUntil(date: string, now = Date.now()) {
  const [y, m, d] = date.split('-').map(Number)
  const today = new Date(now + MINSK_OFFSET_H * 3600_000)
  const t0 = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  return Math.round((Date.UTC(y, m - 1, d) - t0) / 86_400_000)
}
