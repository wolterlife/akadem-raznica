import { useCallback, useEffect, useRef, useState } from 'react'
import type { Owner } from '../../types'
import {
  emptyPace,
  hasPaceData,
  loadLocalPace,
  mergePace,
  pacesEqual,
  pullPace,
  pushPace,
  saveLocalPace,
  setPersonDates,
  stampSamples,
  todayKey,
  type PaceState,
  type PersonDatePatch,
} from './pace'

const PULL_MS = 15_000

export function usePace(
  shared: boolean,
  ready: boolean,
  remaining: Record<Owner, number>,
) {
  const [pace, setPace] = useState<PaceState>(loadLocalPace)
  const paceRef = useRef(pace)
  paceRef.current = pace

  /** First Firebase pull finished (or local-only mode). */
  const hydratedRef = useRef(!shared)
  const skipPushRef = useRef(false)
  const remainingRef = useRef(remaining)

  useEffect(() => {
    remainingRef.current = remaining
  })

  useEffect(() => {
    if (!ready || !hydratedRef.current) return
    setPace((prev) => stampSamples(prev, remainingRef.current, todayKey()))
  }, [ready, remaining.D, remaining.M])

  const applyRemote = useCallback(async () => {
    const remote = await pullPace()
    const local = paceRef.current
    const next = mergePace(
      remote ?? emptyPace(),
      local,
      remainingRef.current,
      todayKey(),
    )

    // Don't echo this hydrate back as a full overwrite unless we must seed.
    skipPushRef.current = true
    hydratedRef.current = true

    if (!pacesEqual(next, local)) {
      setPace(next)
    } else {
      saveLocalPace(next)
    }

    // Computer had dates only in localStorage — upload once so phones see them.
    const remoteEmpty = !hasPaceData(remote)
    if (remoteEmpty && hasPaceData(next)) {
      skipPushRef.current = false
      await pushPace(next)
      skipPushRef.current = true
    }
  }, [])

  useEffect(() => {
    if (!shared) {
      hydratedRef.current = true
      return
    }

    let cancelled = false
    void (async () => {
      try {
        if (!cancelled) await applyRemote()
      } catch (err) {
        console.error('[pace] pull failed', err)
        hydratedRef.current = true
      }
    })()

    const id = window.setInterval(() => {
      void applyRemote().catch((err) => console.error('[pace] pull failed', err))
    }, PULL_MS)

    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [shared, applyRemote])

  useEffect(() => {
    if (!ready || !hydratedRef.current) return
    if (skipPushRef.current) {
      skipPushRef.current = false
      saveLocalPace(pace)
      return
    }

    saveLocalPace(pace)
    if (!shared) return

    const t = window.setTimeout(() => {
      void pushPace(pace).catch((err) => console.error('[pace] push failed', err))
    }, 300)
    return () => window.clearTimeout(t)
  }, [pace, shared, ready])

  function setDates(owner: Owner, patch: PersonDatePatch) {
    setPace((prev) =>
      setPersonDates(prev, owner, patch, remainingRef.current[owner], todayKey()),
    )
  }

  return { pace, setDates }
}
