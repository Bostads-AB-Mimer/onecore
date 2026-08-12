// Rental object codes are segmented like '507-703-00-0011'; everything before
// the last segment identifies the group (e.g. all spaces in one parking area).

export interface CodePrefixGroup<T> {
  prefix: string
  items: T[]
}

/** Group items by rental-object-code prefix, sorted by prefix. */
export function groupByCodePrefix<T>(
  items: T[],
  getCode: (item: T) => string
): CodePrefixGroup<T>[] {
  const byPrefix = new Map<string, T[]>()
  for (const item of items) {
    const code = getCode(item)
    const cut = code.lastIndexOf('-')
    const prefix = cut > 0 ? code.slice(0, cut) : code
    const list = byPrefix.get(prefix) ?? []
    list.push(item)
    byPrefix.set(prefix, list)
  }
  return [...byPrefix.entries()]
    .map(([prefix, groupItems]) => ({ prefix, items: groupItems }))
    .sort((a, b) => a.prefix.localeCompare(b.prefix, 'sv'))
}

/** Compact display range, e.g. '507-703-00-0001 – 0023' (full code if single). */
export function formatCodeRange<T>(
  group: CodePrefixGroup<T>,
  getCode: (item: T) => string
): string {
  if (group.items.length === 1) return getCode(group.items[0])
  const suffixes = group.items
    .map((item) => getCode(item).slice(group.prefix.length + 1))
    .sort()
  return `${group.prefix}-${suffixes[0]} – ${suffixes[suffixes.length - 1]}`
}
