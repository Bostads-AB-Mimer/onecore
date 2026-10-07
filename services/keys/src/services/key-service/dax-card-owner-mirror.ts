import type { CardOwner } from 'dax-client'

/**
 * In-memory mirror of DAX card owners named by rental object code.
 * Filled by the daily sync; lets batch lookups use DAX idfilter instead of
 * one nameFilter query per object. Empty until the first sync completes.
 */

export interface DaxCardOwnerRow {
  cardOwnerId: string
  name: string
}

export interface DaxCardOwnerMatch extends DaxCardOwnerRow {
  rentalObjectCode: string
}

export class MirrorNotReadyError extends Error {
  constructor() {
    super('DAX card owner mirror is syncing')
    this.name = 'MirrorNotReadyError'
  }
}

/** Rental object code, optionally with one trailing letter (806-007-09-0103a). */
const OWNER_NAME_PATTERN = /^\d{3}-\w{3}-\w{2}-\w{3,6}$/

export function ownerDisplayName(owner: CardOwner): string {
  return (owner.familyName || owner.specificName || '').trim()
}

export function isRentalObjectOwnerName(name: string): boolean {
  return OWNER_NAME_PATTERN.test(name)
}

export function isActiveOwner(owner: CardOwner): boolean {
  return owner.state !== 'Archived'
}

/** "806-007-09-0103a" -> "806-007-09-0103"; names without a letter suffix map to themselves. */
export function baseName(name: string): string {
  return /\d[a-zA-Z]$/.test(name) ? name.slice(0, -1) : name
}

const norm = (s: string) => s.trim().toUpperCase()

/** True when the owner is named by exactly this code, with or without a letter suffix. */
export function ownerBelongsTo(owner: CardOwner, rentalObjectCode: string) {
  const name = norm(ownerDisplayName(owner))
  const code = norm(rentalObjectCode)
  return name === code || norm(baseName(name)) === code
}

/** Keep only active owners named by a rental object code, deduped by id. */
export function toOwnerRows(owners: CardOwner[]): DaxCardOwnerRow[] {
  const byId = new Map<string, DaxCardOwnerRow>()
  for (const o of owners) {
    if (!isActiveOwner(o)) continue
    const name = ownerDisplayName(o)
    if (isRentalObjectOwnerName(name)) {
      byId.set(o.cardOwnerId, { cardOwnerId: o.cardOwnerId, name })
    }
  }
  return [...byId.values()]
}

// Each owner is indexed (case-insensitively) under its full name and, when
// different, its base name, so "104-012-01-210A" and "806-007-09-0103a" both resolve.
const rows = new Map<string, DaxCardOwnerRow>()
const index = new Map<string, Set<string>>()
let lastFullSyncAt: Date | null = null

const keysFor = (name: string) => {
  const full = norm(name)
  const base = norm(baseName(name))
  return base === full ? [full] : [full, base]
}

function add(row: DaxCardOwnerRow) {
  rows.set(row.cardOwnerId, row)
  for (const key of keysFor(row.name)) {
    const ids = index.get(key)
    if (ids) ids.add(row.cardOwnerId)
    else index.set(key, new Set([row.cardOwnerId]))
  }
}

function remove(cardOwnerId: string) {
  const row = rows.get(cardOwnerId)
  if (!row) return
  for (const key of keysFor(row.name)) {
    const ids = index.get(key)
    ids?.delete(cardOwnerId)
    if (ids && ids.size === 0) index.delete(key)
  }
  rows.delete(cardOwnerId)
}

export function isReady(): boolean {
  return lastFullSyncAt !== null
}

export function replaceAll(all: DaxCardOwnerRow[]): number {
  rows.clear()
  index.clear()
  all.forEach(add)
  lastFullSyncAt = new Date()
  return rows.size
}

export function replaceForRentalObject(
  rentalObjectCode: string,
  owners: DaxCardOwnerRow[]
): void {
  for (const id of [...(index.get(norm(rentalObjectCode)) ?? [])]) remove(id)
  owners.forEach(add)
}

/** Owners whose name is the code or the code plus one letter. */
export function getOwnersForRentalObjects(
  rentalObjectCodes: string[]
): DaxCardOwnerMatch[] {
  if (!isReady()) throw new MirrorNotReadyError()
  return rentalObjectCodes.flatMap((code) =>
    [...(index.get(norm(code)) ?? [])].map((id) => ({
      ...rows.get(id)!,
      rentalObjectCode: code,
    }))
  )
}

export function getState(): { count: number; lastFullSyncAt: Date | null } {
  return { count: rows.size, lastFullSyncAt }
}

/** Test helper */
export function reset(): void {
  rows.clear()
  index.clear()
  lastFullSyncAt = null
}
