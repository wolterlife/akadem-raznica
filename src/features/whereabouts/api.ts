import {
  mapApiLesson,
  mapApiTeacher,
  parseApiWeek,
  type ScheduleBundle,
  type VstuLesson,
  type VstuTeacher,
  type WeekInfo,
} from './schedule'

const LIVE_BASE = import.meta.env.DEV
  ? '/vstu-api'
  : 'https://schedule.vstu.by/api/v1'

const CACHE_URL = `${import.meta.env.BASE_URL}vstu-schedule.json`

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json() as Promise<T>
}

function parseCache(raw: unknown): ScheduleBundle | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Partial<ScheduleBundle>
  if (!Array.isArray(data.teachers) || !Array.isArray(data.lessons)) return null
  return {
    fetchedAt: String(data.fetchedAt ?? ''),
    live: false,
    week: data.week ?? null,
    teachers: data.teachers,
    lessons: data.lessons,
  }
}

export async function loadCachedBundle(): Promise<ScheduleBundle | null> {
  try {
    return parseCache(await getJson<unknown>(CACHE_URL))
  } catch {
    return null
  }
}

export async function fetchLiveWeek(): Promise<WeekInfo | null> {
  try {
    return parseApiWeek(await getJson<unknown>(`${LIVE_BASE}/schedule/week`))
  } catch {
    return null
  }
}

export async function fetchLiveTeachers(): Promise<VstuTeacher[]> {
  const raw = await getJson<unknown>(`${LIVE_BASE}/schedule/teacher/all`)
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object')
    .map(mapApiTeacher)
    .filter((t) => t.id)
}

export async function fetchLiveLessons(teacherId: number): Promise<VstuLesson[]> {
  const raw = await getJson<unknown>(`${LIVE_BASE}/schedule/teacher/${teacherId}`)
  if (!Array.isArray(raw)) return []
  const out: VstuLesson[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const lesson = mapApiLesson(row as Record<string, unknown>)
    if (lesson) out.push(lesson)
  }
  return out
}

export async function loadScheduleBundle(): Promise<ScheduleBundle> {
  const cached = await loadCachedBundle()
  try {
    const [week, teachers] = await Promise.all([
      fetchLiveWeek(),
      fetchLiveTeachers(),
    ])
    if (!teachers.length) throw new Error('empty teachers')
    return {
      fetchedAt: new Date().toISOString(),
      live: true,
      week: week ?? cached?.week ?? null,
      teachers,
      lessons: cached?.lessons ?? [],
    }
  } catch {
    if (cached) return cached
    return {
      fetchedAt: '',
      live: false,
      week: null,
      teachers: [],
      lessons: [],
    }
  }
}
