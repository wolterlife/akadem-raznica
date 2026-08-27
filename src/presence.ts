import {
  onDisconnect,
  onValue,
  ref,
  remove,
  set,
  update,
  type Unsubscribe,
} from 'firebase/database'
import { getDb } from './firebase'

const PRESENCE_PATH = 'presence'
const IDENTITY_KEY = 'akadem-raznica:identity'
const STALE_MS = 45_000
const HEARTBEAT_MS = 12_000

const COLORS = [
  '#8eb4ff',
  '#ff8fab',
  '#c4a8ff',
  '#7dd3c0',
  '#ffd28a',
  '#6aa8ff',
  '#f0a0ff',
  '#9ae6b4',
]

export interface Identity {
  id: string
  name: string
  color: string
}

export interface PresenceUser extends Identity {
  editingId: string | null
  updatedAt: number
}

type PresenceControls = {
  setEditing: (cardId: string | null) => void
  stop: () => void
}

let activeControls: PresenceControls | null = null

export function loadIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Identity
    if (!parsed.id || !parsed.name || !parsed.color) return null
    return parsed
  } catch {
    return null
  }
}

export function saveIdentity(name: string): Identity {
  const existing = loadIdentity()
  const identity: Identity = {
    id: existing?.id ?? crypto.randomUUID(),
    name: name.trim().slice(0, 24),
    color:
      existing?.color ?? COLORS[Math.floor(Math.random() * COLORS.length)]!,
  }
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity))
  return identity
}

export function clearIdentity() {
  localStorage.removeItem(IDENTITY_KEY)
}

export function setPresenceEditing(cardId: string | null) {
  activeControls?.setEditing(cardId)
}

export function startPresence(
  identity: Identity,
  onUsers: (users: PresenceUser[]) => void,
): () => void {
  const db = getDb()
  if (!db) {
    onUsers([])
    return () => {}
  }

  activeControls?.stop()

  const selfRef = ref(db, `${PRESENCE_PATH}/${identity.id}`)
  const rootRef = ref(db, PRESENCE_PATH)
  let editingId: string | null = null
  let stopped = false

  void set(selfRef, {
    id: identity.id,
    name: identity.name,
    color: identity.color,
    editingId: null,
    updatedAt: Date.now(),
  })
  void onDisconnect(selfRef).remove()

  const beat = window.setInterval(() => {
    if (stopped) return
    void update(selfRef, { updatedAt: Date.now(), editingId }).catch(() => {})
  }, HEARTBEAT_MS)

  const unsub: Unsubscribe = onValue(rootRef, (snap) => {
    const val = snap.val() as Record<string, PresenceUser> | null
    const now = Date.now()
    const list = Object.values(val ?? {}).filter(
      (u) => u && typeof u.id === 'string' && now - (u.updatedAt ?? 0) < STALE_MS,
    )
    onUsers(list)
  })

  const controls: PresenceControls = {
    setEditing(cardId) {
      editingId = cardId
      void update(selfRef, { editingId, updatedAt: Date.now() }).catch(() => {})
    },
    stop() {
      stopped = true
      window.clearInterval(beat)
      unsub()
      void remove(selfRef).catch(() => {})
      if (activeControls === controls) activeControls = null
    },
  }

  activeControls = controls
  return () => controls.stop()
}
