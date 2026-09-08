export const MINSK_TZ = 'Europe/Minsk'

export const PAIR_TIMES: Record<number, [string, string]> = {
  1: ['8:00', '9:35'],
  2: ['9:50', '11:25'],
  3: ['11:40', '13:15'],
  4: ['14:00', '15:35'],
  5: ['15:45', '17:20'],
  6: ['17:30', '19:05'],
  7: ['19:15', '20:50'],
}

export const DAY_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']
export const DAY_FULL = [
  'понедельник',
  'вторник',
  'среда',
  'четверг',
  'пятница',
  'суббота',
  'воскресенье',
]

export type WeekKind = 'num' | 'den' | 'always'

export interface VstuTeacher {
  id: number
  surname: string
  n: string
  p: string
  name: string
}

export interface VstuLesson {
  teacherId: number
  day: number
  num: number
  week: WeekKind
  frame: number
  room: string
  title: string
  kind: string
  group: string
  from: string
  to: string
  off: number
  corr: boolean
}

export interface WeekInfo {
  number: number
  name: string
  date: string
  day: number
}

export interface ScheduleBundle {
  fetchedAt: string
  live: boolean
  week: WeekInfo | null
  teachers: VstuTeacher[]
  lessons: VstuLesson[]
}

export interface MergedSlot {
  day: number
  num: number
  week: WeekKind
  frame: number
  room: string
  cabinet: string
  title: string
  kind: string
  groups: string[]
  from: string
  to: string
  off: number
  corr: boolean
  start: string
  end: string
  startMin: number
  endMin: number
}

export type PresenceKind = 'in_class' | 'between' | 'away' | 'unknown'

export interface Presence {
  kind: PresenceKind
  teacher: VstuTeacher | null
  cabinet?: string
  start?: string
  end?: string
  label: string
  detail: string
  now?: MergedSlot
  next?: MergedSlot
  today: MergedSlot[]
}

interface Clock {
  date: string
  minutes: number
  day: number
}

const WEEKDAY_TO_DAY: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
}

export function minskClock(at = new Date()): Clock {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: MINSK_TZ,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  )
  const hour = Number(parts.hour)
  const minute = Number(parts.minute)
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: hour * 60 + minute,
    day: WEEKDAY_TO_DAY[parts.weekday] ?? 0,
  }
}

export function weekKindFromName(name: string): Exclude<WeekKind, 'always'> {
  return /числ/i.test(name) ? 'num' : 'den'
}

export function weekKindLabel(kind: WeekKind) {
  if (kind === 'num') return 'числитель'
  if (kind === 'den') return 'знаменатель'
  return 'каждую неделю'
}

export function parseApiWeek(raw: unknown): WeekInfo | null {
  if (!raw || typeof raw !== 'object') return null
  const w = raw as Record<string, unknown>
  const date = typeof w.date === 'string' ? w.date : ''
  if (!date) return null
  return {
    number: Number(w.numberOfWeek) || 0,
    name: String(w.nameOfWeek ?? ''),
    date,
    day: Number(w.day) || 0,
  }
}

export function currentWeekKind(
  week: WeekInfo | null,
  clock: Clock,
): Exclude<WeekKind, 'always'> {
  if (!week) return 'den'
  const ref = weekKindFromName(week.name)
  const shift = mondayWeekIndex(clock.date) - mondayWeekIndex(week.date)
  if (shift % 2 === 0) return ref
  return ref === 'num' ? 'den' : 'num'
}

function mondayWeekIndex(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number)
  const utc = Date.UTC(y, m - 1, d)
  const day = new Date(utc).getUTCDay()
  const monday = utc - ((day + 6) % 7) * 86400000
  return Math.floor(monday / 86400000 / 7)
}

function hmToMin(hm: string) {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}

function minToHm(total: number) {
  const wrapped = ((total % 1440) + 1440) % 1440
  const h = Math.floor(wrapped / 60)
  const m = wrapped % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

export function lessonBounds(num: number, offset = 0): [string, string] | null {
  const pair = PAIR_TIMES[num]
  if (!pair) return null
  return [minToHm(hmToMin(pair[0]) + offset), minToHm(hmToMin(pair[1]) + offset)]
}

export function cabinetOf(frame: number, room: string) {
  const loc = room.trim()
  if (!loc) return frame ? String(frame) : '—'
  if (!frame) return loc
  if (loc.includes('-')) return loc
  return `${frame}-${loc}`
}

export function mapApiWeekType(value: string): WeekKind {
  if (/числ/i.test(value)) return 'num'
  if (/знам/i.test(value)) return 'den'
  return 'always'
}

export function mapApiTeacher(raw: Record<string, unknown>): VstuTeacher {
  return {
    id: Number(raw.id),
    surname: String(raw.surname ?? ''),
    n: String(raw.firstLetterName ?? ''),
    p: String(raw.firstLetterPatronymic ?? ''),
    name: String(raw.fullName ?? ''),
  }
}

export function mapApiLesson(raw: Record<string, unknown>): VstuLesson | null {
  const teacher = raw.teacher as Record<string, unknown> | undefined
  const group = raw.group as Record<string, unknown> | undefined
  const teacherId = Number(teacher?.id ?? raw.teacherId)
  const num = Number(raw.lessonNumber)
  if (!teacherId || !num) return null
  return {
    teacherId,
    day: Number(raw.lessonDay),
    num,
    week: mapApiWeekType(String(raw.weekType ?? '')),
    frame: Number(raw.frame) || 0,
    room: String(raw.location ?? ''),
    title: String(raw.disciplineName ?? ''),
    kind: String(raw.shortTypeClassName || raw.typeClassName || ''),
    group: String(group?.name ?? ''),
    from: String(raw.startDate ?? ''),
    to: String(raw.endDate ?? ''),
    off: Number(raw.timeOffset) || 0,
    corr: Boolean(raw.correspondence),
  }
}

function yo(value: string) {
  return value.replaceAll('ё', 'е').replaceAll('Ё', 'Е')
}

export function parseFio(name: string) {
  const clean = yo(name.trim()).replace(/\s+/g, ' ')
  if (!clean) return null
  const short = clean.match(
    /^([^\s.]+)\s+([A-Za-zА-Яа-я])\.?\s*([A-Za-zА-Яа-я])\.?$/,
  )
  if (short) {
    return {
      surname: short[1].toLowerCase(),
      n: short[2].toUpperCase(),
      p: short[3].toUpperCase(),
    }
  }
  const parts = clean.split(' ')
  if (parts.length >= 3) {
    return {
      surname: parts[0].toLowerCase(),
      n: parts[1][0]!.toUpperCase(),
      p: parts[2][0]!.toUpperCase(),
    }
  }
  if (parts.length === 2 && parts[1]!.length > 1) {
    return {
      surname: parts[0].toLowerCase(),
      n: parts[1][0]!.toUpperCase(),
      p: '',
    }
  }
  return null
}

export function teacherKey(t: VstuTeacher) {
  return `${yo(t.surname).toLowerCase()}|${t.n.toUpperCase()}|${t.p.toUpperCase()}`
}

export function nameKeys(name: string) {
  const keys: string[] = []
  const fio = parseFio(name)
  if (fio) {
    keys.push(`${fio.surname}|${fio.n}|${fio.p}`)
    if (!fio.p) keys.push(`${fio.surname}|${fio.n}|`)
  }
  keys.push(yo(name).trim().toLowerCase().replace(/\s+/g, ' '))
  return keys
}

export function indexTeachers(teachers: VstuTeacher[]) {
  const map = new Map<string, VstuTeacher>()
  for (const t of teachers) {
    map.set(teacherKey(t), t)
    map.set(yo(t.name).trim().toLowerCase().replace(/\s+/g, ' '), t)
    map.set(`${yo(t.surname).toLowerCase()}|${t.n.toUpperCase()}|`, t)
  }
  return map
}

export function findTeacher(
  name: string,
  index: Map<string, VstuTeacher>,
): VstuTeacher | null {
  for (const key of nameKeys(name)) {
    const hit = index.get(key)
    if (hit) return hit
  }
  return null
}

function inDateRange(date: string, from: string, to: string) {
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

export function weekMatches(
  lesson: Pick<VstuLesson, 'week'>,
  week: Exclude<WeekKind, 'always'>,
) {
  return lesson.week === 'always' || lesson.week === week
}

export function toSlot(lesson: VstuLesson): MergedSlot | null {
  const bounds = lessonBounds(lesson.num, lesson.off)
  if (!bounds) return null
  return {
    day: lesson.day,
    num: lesson.num,
    week: lesson.week,
    frame: lesson.frame,
    room: lesson.room,
    cabinet: cabinetOf(lesson.frame, lesson.room),
    title: lesson.title,
    kind: lesson.kind,
    groups: lesson.group ? [lesson.group] : [],
    from: lesson.from,
    to: lesson.to,
    off: lesson.off,
    corr: lesson.corr,
    start: bounds[0],
    end: bounds[1],
    startMin: hmToMin(bounds[0]),
    endMin: hmToMin(bounds[1]),
  }
}

function slotKey(slot: MergedSlot, ignoreWeek = false) {
  const week = ignoreWeek || slot.week === 'always' ? '*' : slot.week
  return [
    slot.day,
    slot.num,
    week,
    slot.cabinet,
    slot.title,
    slot.kind,
    slot.from,
    slot.to,
  ].join('|')
}

export function mergeLessons(
  lessons: VstuLesson[],
  opts: {
    date: string
    week?: Exclude<WeekKind, 'always'>
    day?: number
    bothWeeks?: boolean
  },
): MergedSlot[] {
  const merged = new Map<string, MergedSlot>()
  for (const lesson of lessons) {
    if (!inDateRange(opts.date, lesson.from, lesson.to)) continue
    if (opts.day != null && lesson.day !== opts.day) continue
    if (opts.week && !opts.bothWeeks && !weekMatches(lesson, opts.week)) continue
    const slot = toSlot(lesson)
    if (!slot) continue
    const key = slotKey(slot, Boolean(opts.bothWeeks))
    const prev = merged.get(key)
    if (!prev) {
      merged.set(key, slot)
      continue
    }
    for (const g of slot.groups) {
      if (!prev.groups.includes(g)) prev.groups.push(g)
    }
    if (slot.startMin < prev.startMin) {
      prev.start = slot.start
      prev.startMin = slot.startMin
    }
    if (slot.endMin > prev.endMin) {
      prev.end = slot.end
      prev.endMin = slot.endMin
    }
    if (slot.week === 'always') prev.week = 'always'
  }
  return [...merged.values()].sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day
    if (a.startMin !== b.startMin) return a.startMin - b.startMin
    return a.cabinet.localeCompare(b.cabinet, 'ru')
  })
}

export function presenceOf(
  teacher: VstuTeacher | null,
  lessons: VstuLesson[],
  clock: Clock,
  week: Exclude<WeekKind, 'always'>,
): Presence {
  if (!teacher) {
    return {
      kind: 'unknown',
      teacher: null,
      label: '',
      detail: '',
      today: [],
    }
  }
  const today = mergeLessons(lessons, {
    date: clock.date,
    week,
    day: clock.day,
  })
  const now = today.find(
    (s) => clock.minutes >= s.startMin && clock.minutes < s.endMin,
  )
  if (now) {
    return {
      kind: 'in_class',
      teacher,
      cabinet: now.cabinet,
      start: now.start,
      end: now.end,
      label: `${now.cabinet} · ${now.start}–${now.end}`,
      detail: `${now.kind ? `${now.kind} · ` : ''}${now.title}`,
      now,
      next: today.find((s) => s.startMin >= now.endMin),
      today,
    }
  }
  const first = today[0]
  const last = today[today.length - 1]
  if (first && last && clock.minutes >= first.startMin && clock.minutes < last.endMin) {
    const next = today.find((s) => s.startMin > clock.minutes)
    return {
      kind: 'between',
      teacher,
      cabinet: next?.cabinet,
      start: next?.start,
      end: last.end,
      label: next
        ? `между парами · ${next.cabinet} с ${next.start}`
        : 'между парами',
      detail: next ? next.title : `до ${last.end}`,
      next,
      today,
    }
  }
  const upcoming = today.find((s) => s.startMin > clock.minutes)
  if (upcoming) {
    return {
      kind: 'away',
      teacher,
      cabinet: upcoming.cabinet,
      start: upcoming.start,
      end: upcoming.end,
      label: `будет в ${upcoming.cabinet} с ${upcoming.start}`,
      detail: upcoming.title,
      next: upcoming,
      today,
    }
  }
  if (today.length) {
    return {
      kind: 'away',
      teacher,
      label: 'пары прошли',
      detail: `последняя ${last?.cabinet ?? ''} до ${last?.end ?? ''}`.trim(),
      today,
    }
  }
  return {
    kind: 'away',
    teacher,
    label: 'сегодня нет пар',
    detail: 'нажми — расписание на неделю',
    today,
  }
}

export function isoOfWeekday(isoDate: string, todayDay: number, targetDay: number) {
  const [y, m, d] = isoDate.split('-').map(Number)
  const utc = Date.UTC(y, m - 1, d) + (targetDay - todayDay) * 86400000
  return new Date(utc).toISOString().slice(0, 10)
}

export function formatDayDate(isoDate: string, todayDay: number, targetDay: number) {
  const iso = isoOfWeekday(isoDate, todayDay, targetDay)
  const [, m, d] = iso.split('-')
  return `${d}.${m}`
}
