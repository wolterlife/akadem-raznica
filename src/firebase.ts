import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getDatabase, type Database } from 'firebase/database'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

export function isSyncConfigured(): boolean {
  return Boolean(
    config.apiKey &&
      config.databaseURL &&
      config.projectId &&
      config.appId,
  )
}

let app: FirebaseApp | null = null
let db: Database | null = null

export function getDb(): Database | null {
  if (!isSyncConfigured()) return null
  if (!app) {
    app = initializeApp({
      apiKey: config.apiKey!,
      authDomain: config.authDomain,
      databaseURL: config.databaseURL!,
      projectId: config.projectId!,
      appId: config.appId!,
    })
    db = getDatabase(app)
  }
  return db
}
