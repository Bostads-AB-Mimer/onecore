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

/** "806-007-09-0103a" -> "806-007-09-0103"; names without a letter suffix map to themselves. */
export function baseName(name: string): string {
  return /\d[a-zA-Z]$/.test(name) ? name.slice(0, -1) : name
}

// Each owner is indexed under its full name and, when different, its base name,
// so both "104-012-01-210A" (a code) and "806-007-09-0103a" (a suffix) resolve.
const rows = new Map<string, DaxCardOwnerRow>()
const index = new Map<string, Set<string>>()
let lastFullSyncAt: Date | null = null

const keysFor = (name: string) =>
  baseName(name) === name ? [name] : [name, baseName(name)]

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
  for (const id of [...(index.get(rentalObjectCode) ?? [])]) remove(id)
  owners.forEach(add)
}

/** Owners whose name is the code or the code plus one letter. */
export function getOwnersForRentalObjects(
  rentalObjectCodes: string[]
): DaxCardOwnerMatch[] {
  if (!isReady()) throw new MirrorNotReadyError()
  return rentalObjectCodes.flatMap((code) =>
    [...(index.get(code) ?? [])].map((id) => ({
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
