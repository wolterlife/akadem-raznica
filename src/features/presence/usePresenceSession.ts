import { useEffect, useMemo, useState } from 'react'
import {
  clearIdentity,
  loadIdentity,
  setPresenceEditing,
  startPresence,
  type Identity,
  type PresenceUser,
} from '../../presence'

export function usePresenceSession(
  shared: boolean,
  editingId: string | null,
) {
  const [identity, setIdentity] = useState<Identity | null>(() =>
    shared ? loadIdentity() : null,
  )
  const [online, setOnline] = useState<PresenceUser[]>([])

  useEffect(() => {
    if (!shared || !identity) {
      setOnline([])
      return
    }
    return startPresence(identity, setOnline)
  }, [shared, identity])

  useEffect(() => {
    if (!shared) return
    setPresenceEditing(editingId)
  }, [shared, editingId])

  function renameSelf() {
    clearIdentity()
    setIdentity(null)
    setOnline([])
  }

  const editorsByCard = useMemo(() => {
    const map = new Map<string, PresenceUser[]>()
    for (const u of online) {
      if (!u.editingId || u.id === identity?.id) continue
      const list = map.get(u.editingId) ?? []
      list.push(u)
      map.set(u.editingId, list)
    }
    return map
  }, [online, identity?.id])

  return {
    identity,
    setIdentity,
    online,
    editorsByCard,
    renameSelf,
  }
}
