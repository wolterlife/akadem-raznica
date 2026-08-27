import type { Assessment, AssessmentType, ColumnId } from '../../types'
import {
  getMatchKind,
  linkGroupKey,
  normalize,
  profKey,
} from '../../sync'

export type MatchFilter = 'all' | 'ideal' | 'alike' | 'subject' | 'professor'

export type TypeFilter = 'all' | 'exam' | 'credits' | AssessmentType
export type SortKey = 'subject' | 'type' | 'prof' | 'links'

export interface BoardFilters {
  matchFilter: MatchFilter
  typeFilter: TypeFilter
  profFilter: string
  sortKey: SortKey
}

export interface AlignRow {
  key: string
  d: Assessment | null
  m: Assessment | null
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

function matchRank(item: Assessment, all: Assessment[]) {
  if (item.column === 'done') return 4
  const kind = getMatchKind(item, all)
  if (kind === 'ideal') return 0
  if (kind === 'alike') return 1
  if (kind === 'subject') return 2
  if (kind === 'professor') return 3
  return 4
}

function compareItems(
  a: Assessment,
  b: Assessment,
  all: Assessment[],
  sortKey: SortKey,
) {
  if (sortKey === 'links') {
    const byMatch = matchRank(a, all) - matchRank(b, all)
    if (byMatch !== 0) return byMatch
    const byGroup = linkGroupKey(a).localeCompare(linkGroupKey(b), 'ru')
    if (byGroup !== 0) return byGroup
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

  return [...filtered].sort((a, b) => compareItems(a, b, items, sortKey))
}

export function itemsByColumn(
  items: Assessment[],
  column: ColumnId,
): Assessment[] {
  if (column === 'done') {
    return items.filter((i) => i.column === 'done')
  }
  return items.filter((i) => {
    if (i.column === 'done') return false
    const both = i.owners.includes('D') && i.owners.includes('M')
    if (both) return true
    return i.column === column
  })
}

function coversBoth(a: Assessment, b: Assessment) {
  const owners = new Set([...a.owners, ...b.owners])
  return owners.has('D') && owners.has('M')
}

function rowSortKey(row: AlignRow, all: Assessment[]) {
  const sample = row.d ?? row.m
  if (!sample) return 'zzz'
  if (row.d && row.m && row.d.id === row.m.id) {
    return `0:${linkGroupKey(sample)}`
  }
  if (row.d && row.m) {
    const kind = getMatchKind(row.d, all)
    const rank =
      kind === 'ideal'
        ? 1
        : kind === 'alike'
          ? 2
          : kind === 'subject'
            ? 3
            : kind === 'professor'
              ? 4
              : 5
    return `${rank}:${linkGroupKey(sample)}`
  }
  return `9:${sample.subject}`
}

/** Пары D↔M в одних рядах: D+M, общий предмет, общий препод, затем одиночки. */
export function buildAlignRows(
  visible: Assessment[],
  all: Assessment[],
  sortKey: SortKey,
): AlignRow[] {
  const dList = itemsByColumn(visible, 'd')
  const mList = itemsByColumn(visible, 'm')
  const usedD = new Set<string>()
  const usedM = new Set<string>()
  const rows: AlignRow[] = []

  for (const card of dList) {
    const both = card.owners.includes('D') && card.owners.includes('M')
    if (!both || usedD.has(card.id)) continue
    usedD.add(card.id)
    usedM.add(card.id)
    rows.push({ key: `both:${card.id}`, d: card, m: card })
  }

  const tryPair = (
    dCard: Assessment,
    pick: (m: Assessment) => boolean,
    keyPrefix: string,
  ) => {
    if (usedD.has(dCard.id)) return
    const match = mList.find((m) => !usedM.has(m.id) && pick(m))
    if (!match) return
    usedD.add(dCard.id)
    usedM.add(match.id)
    rows.push({
      key: `${keyPrefix}:${dCard.id}:${match.id}`,
      d: dCard,
      m: match,
    })
  }

  for (const dCard of dList) {
    const subj = normalize(dCard.subject)
    tryPair(
      dCard,
      (m) => normalize(m.subject) === subj && coversBoth(dCard, m),
      'subj',
    )
  }

  for (const dCard of dList) {
    const pk = profKey(dCard.professor)
    if (!pk) continue
    tryPair(
      dCard,
      (m) =>
        profKey(m.professor) === pk &&
        normalize(m.subject) !== normalize(dCard.subject) &&
        coversBoth(dCard, m),
      'prof',
    )
  }

  const remD = dList
    .filter((c) => !usedD.has(c.id))
    .sort((a, b) => compareItems(a, b, all, sortKey))
  const remM = mList
    .filter((c) => !usedM.has(c.id))
    .sort((a, b) => compareItems(a, b, all, sortKey))

  const max = Math.max(remD.length, remM.length)
  for (let i = 0; i < max; i++) {
    rows.push({
      key: `solo:${remD[i]?.id ?? 'x'}:${remM[i]?.id ?? 'y'}`,
      d: remD[i] ?? null,
      m: remM[i] ?? null,
    })
  }

  return rows.sort((a, b) =>
    rowSortKey(a, all).localeCompare(rowSortKey(b, all), 'ru'),
  )
}

/** Ordered cards for a column — pairs first, no empty spacer holes. */
export function orderedColumnItems(
  visible: Assessment[],
  all: Assessment[],
  sortKey: SortKey,
  column: 'd' | 'm',
): Assessment[] {
  const rows = buildAlignRows(visible, all, sortKey)
  const out: Assessment[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const item = column === 'd' ? row.d : row.m
    if (!item || seen.has(item.id)) continue
    seen.add(item.id)
    out.push(item)
  }
  return out
}

export function computeStats(items: Assessment[]) {
  const open = items.filter((i) => i.column !== 'done')
  return {
    open: open.length,
    ideal: open.filter((i) => getMatchKind(i, items) === 'ideal').length,
    alike: open.filter((i) => getMatchKind(i, items) === 'alike').length,
    subject: open.filter((i) => getMatchKind(i, items) === 'subject').length,
    professor: open.filter((i) => getMatchKind(i, items) === 'professor')
      .length,
    done: items.length - open.length,
  }
}
