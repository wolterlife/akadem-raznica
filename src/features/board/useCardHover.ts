import { useRef, useState } from 'react'

export function useCardHover(delayMs = 120) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const clearRef = useRef<number | null>(null)

  function onCardHover(id: string | null) {
    if (clearRef.current != null) {
      window.clearTimeout(clearRef.current)
      clearRef.current = null
    }
    if (id) {
      setHoveredId(id)
      return
    }
    clearRef.current = window.setTimeout(() => {
      setHoveredId(null)
      clearRef.current = null
    }, delayMs)
  }

  return { hoveredId, onCardHover }
}
