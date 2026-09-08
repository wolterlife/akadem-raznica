import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { fetchLiveLessons, loadScheduleBundle } from './api'
import { isUnknownProfessor } from '../../professors'
import {
  currentWeekKind,
  findTeacher,
  indexTeachers,
  minskClock,
  presenceOf,
  type ScheduleBundle,
  type VstuLesson,
} from './schedule'
import { WhereContext, type WhereState } from './where-context'

export function WhereProvider({
  names,
  children,
}: {
  names: string[]
  children: ReactNode
}) {
  const [bundle, setBundle] = useState<ScheduleBundle | null>(null)
  const [liveLessons, setLiveLessons] = useState<Record<number, VstuLesson[]>>(
    {},
  )
  const [now, setNow] = useState(() => Date.now())
  const fetchedIds = useRef(new Set<number>())

  useEffect(() => {
    const tick = () => setNow(Date.now())
    const id = window.setInterval(tick, 20_000)
    const onVis = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  useEffect(() => {
    let gone = false
    void loadScheduleBundle().then((next) => {
      if (!gone) setBundle(next)
    })
    return () => {
      gone = true
    }
  }, [])

  const teacherIndex = useMemo(
    () => indexTeachers(bundle?.teachers ?? []),
    [bundle],
  )

  const wantedIds = useMemo(() => {
    const ids: number[] = []
    for (const name of names) {
      if (isUnknownProfessor(name)) continue
      const teacher = findTeacher(name, teacherIndex)
      if (teacher && !ids.includes(teacher.id)) ids.push(teacher.id)
    }
    return ids
  }, [names, teacherIndex])

  const wantedKey = wantedIds.join(',')

  useEffect(() => {
    if (!bundle?.live || wantedIds.length === 0) return
    const missing = wantedIds.filter((id) => !fetchedIds.current.has(id))
    if (!missing.length) return
    for (const id of missing) fetchedIds.current.add(id)
    let gone = false
    void Promise.all(
      missing.map(async (id) => {
        try {
          return [id, await fetchLiveLessons(id)] as const
        } catch {
          fetchedIds.current.delete(id)
          return [id, null] as const
        }
      }),
    ).then((rows) => {
      if (gone) return
      setLiveLessons((prev) => {
        const next = { ...prev }
        for (const [id, lessons] of rows) {
          if (lessons) next[id] = lessons
        }
        return next
      })
    })
    return () => {
      gone = true
    }
  }, [bundle?.live, wantedKey, wantedIds])

  const cachedByTeacher = useMemo(() => {
    const map = new Map<number, VstuLesson[]>()
    for (const lesson of bundle?.lessons ?? []) {
      const list = map.get(lesson.teacherId)
      if (list) list.push(lesson)
      else map.set(lesson.teacherId, [lesson])
    }
    return map
  }, [bundle])

  const teacherFor = useCallback(
    (name: string) =>
      isUnknownProfessor(name) ? null : findTeacher(name, teacherIndex),
    [teacherIndex],
  )

  const lessonsFor = useCallback(
    (teacherId: number) =>
      liveLessons[teacherId] ?? cachedByTeacher.get(teacherId) ?? [],
    [liveLessons, cachedByTeacher],
  )

  const value = useMemo<WhereState>(() => {
    const clock = minskClock(new Date(now))
    const weekKind = currentWeekKind(bundle?.week ?? null, clock)
    const weekName = weekKind === 'num' ? 'Числитель' : 'Знаменатель'
    const weekLabel = bundle?.week
      ? `${clock.date.slice(8, 10)}.${clock.date.slice(5, 7)} · ${bundle.week.number || '—'} нед. · ${weekName}`
      : weekName

    return {
      ready: Boolean(bundle),
      weekLabel,
      weekKind,
      clockDate: clock.date,
      clockDay: clock.day,
      clockMinutes: clock.minutes,
      teacherFor,
      lessonsFor,
      presenceFor(name: string) {
        const teacher = teacherFor(name)
        if (!teacher) return presenceOf(null, [], clock, weekKind)
        const cached = cachedByTeacher.get(teacher.id)
        const live = liveLessons[teacher.id]
        if (bundle?.live && live == null && !cached) {
          return presenceOf(null, [], clock, weekKind)
        }
        return presenceOf(teacher, live ?? cached ?? [], clock, weekKind)
      },
    }
  }, [bundle, now, teacherFor, lessonsFor, liveLessons, cachedByTeacher])

  return (
    <WhereContext.Provider value={value}>{children}</WhereContext.Provider>
  )
}
