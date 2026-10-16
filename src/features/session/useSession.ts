import { useCallback, useEffect, useRef, useState } from 'react'
import { PULL_INTERVAL_MS } from '../../sync'
import { deriveExams, loadSessionBundle, type ExamInfo, type SessionBundle } from './schedule'
import {
  emptyProgress,
  loadLocalSession,
  mergeSession,
  pullSession,
  pushSession,
  SEED_HINTS,
  type ExamProgress,
  type SessionState,
} from './store'

export function useSession(shared: boolean) {
  const [bundle, setBundle] = useState<SessionBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState<SessionState>(loadLocalSession)
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let alive = true
    void loadSessionBundle().then((b) => {
      if (!alive) return
      setBundle(b)
      setLoading(false)
    })
    const tick = setInterval(() => setNow(Date.now()), 60_000)
    return () => {
      alive = false
      clearInterval(tick)
    }
  }, [])

  useEffect(() => {
    if (!shared) return
    let alive = true
    async function pull() {
      try {
        const remote = await pullSession()
        if (!alive || !remote) return
        const merged = mergeSession(stateRef.current, remote)
        if (JSON.stringify(merged) !== JSON.stringify(stateRef.current)) setState(merged)
      } catch {
        /* offline — остаёмся на локальных данных */
      }
    }
    void pull()
    const id = setInterval(() => void pull(), PULL_INTERVAL_MS)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [shared])

  const exams: ExamInfo[] = bundle ? deriveExams(bundle.lessons, now) : []

  const progressOf = useCallback(
    (exam: ExamInfo): ExamProgress =>
      state[exam.key] ?? { ...emptyProgress(), ...SEED_HINTS[exam.title] },
    [state],
  )

  const update = useCallback(
    (exam: ExamInfo, patch: Partial<ExamProgress>) => {
      const prev = stateRef.current[exam.key] ?? {
        ...emptyProgress(),
        ...SEED_HINTS[exam.title],
      }
      const next: SessionState = {
        ...stateRef.current,
        [exam.key]: { ...prev, ...patch, updatedAt: Date.now() },
      }
      stateRef.current = next
      setState(next)
      void pushSession(next).catch(() => undefined)
    },
    [],
  )

  return { bundle, loading, exams, now, progressOf, update }
}
