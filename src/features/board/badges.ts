import type { Assessment, AssessmentType, MatchKind, Owner } from '../../types'
import { TYPE_LABEL } from '../../types'
import { getMatchKind, getRelatedLinks, normalize, profKey, type LinkReason } from '../../sync'
import { buildAlignRows } from './filters'
import { isFullyDone, isPendingDone, isShared } from './progress'

export type BadgeKind =
  | 'both'
  | 'ideal'
  | 'alike'
  | 'subject'
  | 'professor'
  | 'own-prof'
  | 'partial'

export type LinkScope = 'external' | 'internal'

export interface CardBadge {
  key: string
  text: string
  kind: BadgeKind
  scope: LinkScope
}

function subjectsWord(n: number) {
  const n10 = n % 10
  const n100 = n % 100
  if (n10 === 1 && n100 !== 11) return 'предмет'
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return 'предмета'
  return 'предметов'
}

function internalSameProfessorCount(
  card: Assessment,
  all: Assessment[],
  forOwner: Owner | null,
) {
  const prof = profKey(card.professor)
  if (!prof) return 0
  const who = forOwner ?? card.owners[0]
  if (!who) return 0
  return all.filter((a) => {
    if (a.id === card.id || isFullyDone(a)) return false
    if (!a.owners.includes(who)) return false
    if (profKey(a.professor) !== prof) return false
    return normalize(a.subject) !== normalize(card.subject)
  }).length
}

/** External = D↔M, internal = within one person. */
export function getCardBadges(
  card: Assessment,
  all: Assessment[],
  forOwner: Owner | null = null,
): CardBadge[] {
  const badges: CardBadge[] = []
  const match: MatchKind = getMatchKind(card, all)

  if (!isPendingDone(card)) {
    if (isShared(card) || match === 'ideal') {
      badges.push({
        key: 'ideal',
        text: 'полное совпадение',
        kind: 'ideal',
        scope: 'external',
      })
    } else if (match === 'alike') {
      badges.push({
        key: 'alike',
        text: 'тот же предмет и преподаватель',
        kind: 'alike',
        scope: 'external',
      })
    } else if (match === 'subject') {
      badges.push({
        key: 'subject',
        text: 'тот же предмет',
        kind: 'subject',
        scope: 'external',
      })
    } else if (match === 'professor') {
      badges.push({
        key: 'professor',
        text: 'тот же преподаватель',
        kind: 'professor',
        scope: 'external',
      })
    }
  }

  const ownExtra = internalSameProfessorCount(card, all, forOwner)
  if (ownExtra >= 1) {
    badges.push({
      key: 'own-prof',
      text: `ещё ${ownExtra} ${subjectsWord(ownExtra)} у этого преподавателя`,
      kind: 'own-prof',
      scope: 'internal',
    })
  }

  return badges
}

export interface CardRelation {
  id: string
  subject: string
  short: string
  type: AssessmentType
  professor: string
  owners: Owner[]
  reasons: LinkReason[]
  scope: LinkScope
}

function toRelation(
  other: Assessment,
  reasons: LinkReason[],
  scope: LinkScope,
): CardRelation {
  return {
    id: other.id,
    subject: other.subject,
    short: other.short,
    type: other.type,
    professor: other.professor.trim(),
    owners: other.owners,
    reasons,
    scope,
  }
}

function coversBothOwners(a: Assessment, b: Assessment) {
  const owners = new Set([...a.owners, ...b.owners])
  return owners.has('D') && owners.has('M')
}

function reasonRank(reasons: LinkReason[]) {
  if (reasons.includes('subject') && reasons.includes('professor')) return 0
  if (reasons.includes('subject') || reasons.includes('shared')) return 1
  if (reasons.includes('professor')) return 2
  return 3
}

export function listCardRelations(
  card: Assessment,
  all: Assessment[],
  forOwner: Owner | null = null,
): CardRelation[] {
  const who = forOwner ?? (card.owners.length === 1 ? card.owners[0] : null)
  if (!who) return []
  const links = getRelatedLinks(card, all)
  const out: CardRelation[] = []
  for (const other of all) {
    if (other.id === card.id || isFullyDone(other)) continue
    if (!card.owners.includes(who) || !other.owners.includes(who)) continue
    const reasons = links.get(other.id)
    if (!reasons?.length) continue
    const aboutSubject =
      reasons.includes('subject') || reasons.includes('shared')
    if (!aboutSubject) continue
    const counterpart: Owner = who === 'D' ? 'M' : 'D'
    const thisIsOnlyThisPerson = !card.owners.includes(counterpart)
    const otherInvolvesOtherPerson = other.owners.includes(counterpart)
    if (thisIsOnlyThisPerson && otherInvolvesOtherPerson) continue
    out.push(toRelation(other, reasons, 'internal'))
  }
  return out.slice(0, 4)
}

/** D↔M peers for mobile jump buttons — named cards, not abstract match labels. */
export function listExternalPeers(
  card: Assessment,
  all: Assessment[],
): CardRelation[] {
  if (isFullyDone(card) || isPendingDone(card) || isShared(card)) return []
  const who = card.owners.length === 1 ? card.owners[0] : null
  if (!who) return []
  const counterpart: Owner = who === 'D' ? 'M' : 'D'
  const links = getRelatedLinks(card, all)
  const out: CardRelation[] = []
  for (const other of all) {
    if (other.id === card.id || isFullyDone(other) || isPendingDone(other)) {
      continue
    }
    if (!other.owners.includes(counterpart)) continue
    const reasons = links.get(other.id)
    if (!reasons?.length) continue
    if (!coversBothOwners(card, other)) continue
    out.push(toRelation(other, reasons, 'external'))
  }

  const bySubject = out.filter(
    (r) => r.reasons.includes('subject') || r.reasons.includes('shared'),
  )
  if (bySubject.length) {
    return bySubject
      .sort((a, b) => reasonRank(a.reasons) - reasonRank(b.reasons))
      .slice(0, 3)
  }

  // Professor-only: same pairing as desktop column alignment.
  const open = all.filter((a) => !isFullyDone(a) && !isPendingDone(a))
  const rows = buildAlignRows(open, all, 'links')
  const row = rows.find((r) => r.d?.id === card.id || r.m?.id === card.id)
  const aligned = row
    ? row.d?.id === card.id
      ? row.m
      : row.d
    : null
  if (aligned && aligned.id !== card.id) {
    const reasons = links.get(aligned.id)
    if (reasons?.length) return [toRelation(aligned, reasons, 'external')]
  }

  const exclusive = out.filter((r) => r.owners.length === 1)
  const pool = exclusive.length ? exclusive : out
  return pool
    .sort((a, b) => reasonRank(a.reasons) - reasonRank(b.reasons))
    .slice(0, 2)
}

export function relationCaption(card: Assessment, rel: CardRelation) {
  const sameSubject = normalize(rel.subject) === normalize(card.subject)
  if (sameSubject) {
    const bits = ['тот же предмет']
    if (rel.type !== card.type) bits.push(TYPE_LABEL[rel.type])
    if (rel.professor && rel.professor !== card.professor.trim()) {
      bits.push(rel.professor)
    }
    return { title: null as string | null, why: bits.join(' · ') }
  }
  return {
    title: rel.subject,
    why: TYPE_LABEL[rel.type],
  }
}

export function peerWhy(reasons: LinkReason[]) {
  const hasSub = reasons.includes('subject') || reasons.includes('shared')
  const hasProf = reasons.includes('professor')
  if (hasSub && hasProf) return 'предмет и препод'
  if (hasSub) return 'тот же предмет'
  if (hasProf) return 'тот же преподаватель'
  return 'связь'
}

export function peerOwnersLabel(owners: Owner[]) {
  if (owners.includes('D') && owners.includes('M')) return 'D+M'
  return owners[0] ?? ''
}
