const PROF_KEY = 'akadem-raznica:prof-filter'

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
