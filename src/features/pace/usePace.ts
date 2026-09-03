import { useCallback, useEffect, useRef, useState } from 'react'
import type { Owner } from '../../types'
import {
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
} from './pace'

const PULL_MS = 15_000

export function usePace(
  shared: boolean,
  ready: boolean,
  remaining: Record<Owner, number>,
) {
  const [pace, setPace] = useState<PaceState>(loadLocalPace)
  const readyRef = useRef(!shared)
  const remainingRef = useRef(remaining)

  useEffect(() => {
    remainingRef.current = remaining
  })

  useEffect(() => {
    if (!ready) return
    const today = todayKey()
    setPace((prev) => stampSamples(prev, remainingRef.current, today))
  }, [ready, remaining.D, remaining.M])

  const applyRemote = useCallback(async () => {
    const remote = await pullPace()
    setPace((local) => {
      const next = mergePace(remote, local, remainingRef.current, todayKey())
      return pacesEqual(next, local) ? local : next
    })
    readyRef.current = true
  }, [])

  useEffect(() => {
    if (!shared) return

    let cancelled = false
    void (async () => {
      try {
        if (!cancelled) await applyRemote()
      } catch (err) {
        console.error('[pace] pull failed', err)
        readyRef.current = true
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
    if (!ready || !readyRef.current) return
    saveLocalPace(pace)
    if (!shared) return
    const t = window.setTimeout(() => {
      void pushPace(pace).catch((err) => console.error('[pace] push failed', err))
    }, 300)
    return () => window.clearTimeout(t)
  }, [pace, shared, ready])

  function setDates(
    owner: Owner,
    patch: { startedAt?: string | null; due?: string | null },
  ) {
    setPace((prev) =>
      setPersonDates(prev, owner, patch, remainingRef.current[owner], todayKey()),
    )
  }

  return { pace, setDates }
}
