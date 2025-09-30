import type { Key, KeyType } from '@/services/types'
import { KeyTypeLabels } from '@/services/types'

function seededRange(seedBase: string, min: number, max: number) {
  let hash = 0
  for (let i = 0; i < seedBase.length; i++)
    hash = (hash * 31 + seedBase.charCodeAt(i)) >>> 0
  return (hash % (max - min + 1)) + min
}

function objectNumberForType(leaseId: string, type: KeyType): number {
  return seededRange(`${leaseId}:${type}-obj`, 1, 999)
}

// How many to mock per type
const SPEC: Partial<Record<KeyType, [number, number]>> = {
  LGH: [2, 5],
  PB: [1, 3],
  TP: [1, 3],
  GEM: [1, 3],
  // HUS, FS, HN intentionally 0 for now
}

export function generateMockKeys(leaseId: string): Key[] {
  const keys: Key[] = []
  let counter = 1

  ;(Object.keys(SPEC) as KeyType[]).forEach((type) => {
    const [min, max] = SPEC[type]!
    const objNo = objectNumberForType(leaseId, type)
    const count = seededRange(`${leaseId}:${type}-count`, min, max)

    for (let i = 1; i <= count; i++) {
      keys.push({
        id: `${type}-${counter}`,
        keyName: `${KeyTypeLabels[type]} ${objNo}`,
        // NOTE: your generated Key['keyType'] only includes "LGH" | "PB" | "FS" | "HN"
        // We cast here so we can still mock TP/GEM for UI.
        keyType: type as unknown as Key['keyType'],
        keySequenceNumber: i,
        flexNumber: seededRange(`${leaseId}:${type}-flex-${i}`, 1, 3),
        rentalObjectCode: String(objNo),
        keySystemId: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      counter++
    }
  })

  return keys
}

// Accept a single key or an array, and return counts only for present types.
// Using Partial avoids forcing all KeyType members (e.g., TP/HUS/GEM) to exist.
type Keyish = Pick<Key, 'keyType'>

export function countKeysByType(
  keys: Keyish[] | Keyish
): Partial<Record<KeyType, number>> {
  const list = Array.isArray(keys) ? keys : [keys]
  const acc: Partial<Record<KeyType, number>> = {}
  list.forEach((k) => {
    const t = k.keyType as unknown as KeyType
    acc[t] = (acc[t] ?? 0) + 1
  })
  return acc
}
