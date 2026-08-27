import type { Assessment, MatchKind } from './types'

const STORAGE_KEY = 'akadem-raznica:v1'

export function loadAssessments(fallback: Assessment[]): Assessment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Assessment[]
    if (!Array.isArray(parsed)) return fallback
    return parsed
  } catch {
    return fallback
  }
}

export function saveAssessments(items: Assessment[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

/**
 * ideal — оба студента, один предмет и (обычно) один препод
 * professor — разные предметы, но общий преподаватель
 */
export function getMatchKind(card: Assessment, all: Assessment[]): MatchKind {
  if (card.owners.includes('D') && card.owners.includes('M')) {
    return 'ideal'
  }

  const others = all.filter((a) => a.id !== card.id && a.column !== 'done')
  const subj = normalize(card.subject)
  const prof = normalize(card.professor)

  const idealPair = others.some((a) => {
    const coversBoth =
      new Set([...card.owners, ...a.owners]).has('D') &&
      new Set([...card.owners, ...a.owners]).has('M')
    return (
      coversBoth &&
      normalize(a.subject) === subj &&
      normalize(a.professor) === prof
    )
  })
  if (idealPair) return 'ideal'

  const professorPair = others.some((a) => {
    const coversBoth =
      new Set([...card.owners, ...a.owners]).has('D') &&
      new Set([...card.owners, ...a.owners]).has('M')
    return coversBoth && normalize(a.professor) === prof && normalize(a.subject) !== subj
  })
  if (professorPair) return 'professor'

  return 'none'
}

function normalize(value: string) {
  return value.trim().toLowerCase()
}

export function uid() {
  return crypto.randomUUID()
}
