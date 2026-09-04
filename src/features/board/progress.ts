import type { Assessment, ColumnId, Owner } from '../../types'

export function isShared(item: Assessment) {
  return item.owners.includes('D') && item.owners.includes('M')
}

export function columnOwner(column: ColumnId): Owner | null {
  if (column === 'd') return 'D'
  if (column === 'm') return 'M'
  return null
}

export function doneOwnersOf(item: Assessment): Owner[] {
  if (item.doneBy && item.doneBy.length > 0) {
    return item.owners.filter((owner) => item.doneBy!.includes(owner))
  }
  if (item.column === 'done') return [...item.owners]
  return []
}

export function isDoneFor(item: Assessment, owner: Owner) {
  return doneOwnersOf(item).includes(owner)
}

export function isFullyDone(item: Assessment) {
  return item.owners.length > 0 && item.owners.every((owner) => isDoneFor(item, owner))
}

/** «Под вопросом» уже закрыто — сдавать не надо, совместной сдачи не будет. */
export function isPendingDone(item: Assessment) {
  return Boolean(item.pending) && doneOwnersOf(item).length > 0
}

export function isOpenFor(item: Assessment, owner: Owner) {
  return item.owners.includes(owner) && !isDoneFor(item, owner)
}

export function pendingOwnersOf(item: Assessment): Owner[] {
  return item.owners.filter((owner) => !isDoneFor(item, owner))
}

export function columnFromProgress(owners: Owner[], doneBy: Owner[]): ColumnId {
  const pending = owners.filter((owner) => !doneBy.includes(owner))
  if (pending.length === 0) return 'done'
  if (pending.includes('D') && !pending.includes('M')) return 'd'
  if (pending.includes('M') && !pending.includes('D')) return 'm'
  return owners.includes('D') ? 'd' : 'm'
}

export function noteFor(item: Assessment, owner: Owner | null): string {
  if (owner) {
    const personal = item.notes?.[owner]?.trim()
    if (personal) return personal
  }
  return item.note?.trim() ?? ''
}

export function notesPayload(
  owners: Owner[],
  noteD: string,
  noteM: string,
): Pick<Assessment, 'notes'> {
  const notes: NonNullable<Assessment['notes']> = {}
  if (owners.includes('D') && noteD.trim()) notes.D = noteD.trim()
  if (owners.includes('M') && noteM.trim()) notes.M = noteM.trim()
  return Object.keys(notes).length ? { notes } : {}
}

/** Move a card between columns. Shared cards credit/uncredit per person. */
export function applyMove(
  item: Assessment,
  target: ColumnId,
  from?: ColumnId,
): Assessment {
  if (!isShared(item)) {
    return {
      ...item,
      column: target,
      doneBy: target === 'done' ? [...item.owners] : [],
    }
  }

  const fromOwner = from ? columnOwner(from) : null
  const toOwner = columnOwner(target)
  const done = new Set(doneOwnersOf(item))

  if (target === 'done') {
    if (fromOwner && item.owners.includes(fromOwner)) done.add(fromOwner)
    else item.owners.forEach((owner) => done.add(owner))
  } else if (toOwner) {
    if (from && from !== 'done' && fromOwner && fromOwner !== toOwner) {
      return item
    }
    done.delete(toOwner)
  }

  const doneBy = item.owners.filter((owner) => done.has(owner))
  return {
    ...item,
    doneBy,
    column: columnFromProgress(item.owners, doneBy),
  }
}
