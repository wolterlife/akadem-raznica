const PROF_KEY = 'akadem-raznica:prof-filter'
const PACE_PENDING_KEY = 'akadem-raznica:pace-pending'

export function loadProfFilter(): string {
  try {
    return localStorage.getItem(PROF_KEY) || 'all'
  } catch {
    return 'all'
  }
}

export function saveProfFilter(value: string) {
  try {
    localStorage.setItem(PROF_KEY, value)
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadPaceCountPending(): boolean {
  try {
    return localStorage.getItem(PACE_PENDING_KEY) !== '0'
  } catch {
    return true
  }
}

export function savePaceCountPending(value: boolean) {
  try {
    localStorage.setItem(PACE_PENDING_KEY, value ? '1' : '0')
  } catch {
    /* ignore quota / private mode */
  }
}
