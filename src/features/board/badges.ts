import type { Assessment, MatchKind, Owner } from '../../types'
import { getMatchKind, normalize, profKey } from '../../sync'

export type BadgeKind =
  | 'both'
  | 'ideal'
  | 'subject'
  | 'professor'
  | 'own-prof'

export interface CardBadge {
  key: string
  text: string
  kind: BadgeKind
}

function counterpart(owners: Owner[]): Owner | null {
  const hasD = owners.includes('D')
  const hasM = owners.includes('M')
  if (hasD && hasM) return null
  if (hasD) return 'M'
  if (hasM) return 'D'
  return null
}

/** Short status badges for a card (mobile-friendly). */
export function getCardBadges(
  card: Assessment,
  all: Assessment[],
): CardBadge[] {
  if (card.owners.includes('D') && card.owners.includes('M')) {
    return [{ key: 'both', text: 'нужно D+M', kind: 'both' }]
  }

  const other = counterpart(card.owners)
  const match: MatchKind = getMatchKind(card, all)
  const badges: CardBadge[] = []

  if (match === 'ideal' && other) {
    badges.push({ key: 'ideal', text: `1 в 1 с ${other}`, kind: 'ideal' })
    return badges
  }

  if (match === 'subject' && other) {
    badges.push({
      key: 'subject',
      text: `предмет у ${other}`,
      kind: 'subject',
    })
    return badges
  }

  if (match === 'professor' && other) {
    badges.push({
      key: 'professor',
      text: `препод у ${other}`,
      kind: 'professor',
    })
    return badges
  }

  const prof = profKey(card.professor)
  if (!prof) return badges

  const ownExtra = all.filter((a) => {
    if (a.id === card.id || a.column === 'done') return false
    if (!a.owners.some((o) => card.owners.includes(o))) return false
    if (profKey(a.professor) !== prof) return false
    return normalize(a.subject) !== normalize(card.subject)
  })

  if (ownExtra.length === 1) {
    badges.push({
      key: 'own-prof',
      text: 'ещё твой · этот препод',
      kind: 'own-prof',
    })
  } else if (ownExtra.length > 1) {
    badges.push({
      key: 'own-prof',
      text: `ещё ${ownExtra.length} · этот препод`,
      kind: 'own-prof',
    })
  }

  return badges
}
