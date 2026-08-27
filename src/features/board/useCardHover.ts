import { useRef, useState } from 'react'

export function useCardHover(delayMs = 120) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [hoveredCol, setHoveredCol] = useState<string | null>(null)
  const clearRef = useRef<number | null>(null)

  function onCardHover(id: string | null, col?: string | null) {
    if (clearRef.current != null) {
      window.clearTimeout(clearRef.current)
      clearRef.current = null
    }
    if (id) {
      setHoveredId(id)
      setHoveredCol(col ?? null)
      return
    }
    clearRef.current = window.setTimeout(() => {
      setHoveredId(null)
      setHoveredCol(null)
      clearRef.current = null
    }, delayMs)
  }

  return { hoveredId, hoveredCol, onCardHover }
}
