import type { Assessment, AssessmentType, ColumnId } from '../../types'
import { getMatchKind, linkGroupKey } from '../../sync'

export type MatchFilter = 'all' | 'ideal' | 'professor'
export type TypeFilter = 'all' | 'exam' | 'credits' | AssessmentType
export type SortKey = 'subject' | 'type' | 'prof' | 'links'

export interface BoardFilters {
  matchFilter: MatchFilter
  typeFilter: TypeFilter
  profFilter: string
  sortKey: SortKey
}

const TYPE_ORDER: AssessmentType[] = [
  'exam',
  'diff_credit',
  'credit',
  'course_project',
  'coursework',
  'practice',
]

export function listSubjects(items: Assessment[]): string[] {
  const set = new Set<string>()
  for (const item of items) {
    const s = item.subject.trim()
    if (s) set.add(s)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'ru'))
}

export function listProfessors(items: Assessment[]): string[] {
  const set = new Set<string>()
  for (const item of items) {
    const d = item.professor.trim()
    if (d && d !== '—' && d !== '-') set.add(d)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'ru'))
}

export function filterAndSortItems(
  items: Assessment[],
  filters: BoardFilters,
): Assessment[] {
  const { matchFilter, typeFilter, profFilter, sortKey } = filters

  const filtered = items.filter((item) => {
    if (matchFilter !== 'all') {
      if (item.column === 'done') return true
      if (getMatchKind(item, items) !== matchFilter) return false
    }

    if (typeFilter !== 'all') {
      if (typeFilter === 'exam' && item.type !== 'exam') return false
      if (
        typeFilter === 'credits' &&
        item.type !== 'credit' &&
        item.type !== 'diff_credit'
      ) {
        return false
      }
      if (
        typeFilter !== 'exam' &&
        typeFilter !== 'credits' &&
        item.type !== typeFilter
      ) {
        return false
      }
    }

    if (profFilter !== 'all' && item.professor.trim() !== profFilter) {
      return false
    }

    return true
  })

  return [...filtered].sort((a, b) => {
    if (sortKey === 'links') {
      const diff = linkGroupKey(a).localeCompare(linkGroupKey(b), 'ru')
      if (diff !== 0) return diff
    }
    if (sortKey === 'type') {
      const diff = TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type)
      if (diff !== 0) return diff
    }
    if (sortKey === 'prof') {
      const diff = a.professor.localeCompare(b.professor, 'ru')
      if (diff !== 0) return diff
    }
    return a.subject.localeCompare(b.subject, 'ru')
  })
}

export function itemsByColumn(
  items: Assessment[],
  column: ColumnId,
): Assessment[] {
  return items.filter((i) => i.column === column)
}

export function computeStats(items: Assessment[]) {
  const open = items.filter((i) => i.column !== 'done')
  return {
    open: open.length,
    ideal: open.filter((i) => getMatchKind(i, items) === 'ideal').length,
    professor: open.filter((i) => getMatchKind(i, items) === 'professor')
      .length,
    done: items.length - open.length,
  }
}
