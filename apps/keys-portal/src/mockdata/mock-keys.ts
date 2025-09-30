import type { Key, KeyType } from '@/services/types'

function seededHash(seedBase: string): number {
  let hash = 0
  for (let i = 0; i < seedBase.length; i++) {
    hash = (hash * 31 + seedBase.charCodeAt(i)) >>> 0
  }
  return hash >>> 0
}

function seededRange(seedBase: string, min: number, max: number) {
  const hash = seededHash(seedBase)
  return (hash % (max - min + 1)) + min
}

function letters(seedBase: string, len: number): string {
  let h = seededHash(seedBase)
  let out = ''
  for (let i = 0; i < len; i++) {
    const ch = 65 + (h % 26) // A-Z
    out += String.fromCharCode(ch)
    h = (h * 1103515245 + 12345) >>> 0
  }
  return out
}

function baseCode(leaseId: string): string {
  const num = seededRange(`${leaseId}:base`, 10, 99)
  return `2L${num}`
}

function systemCode(leaseId: string): string {
  const prefix = letters(`${leaseId}:sys`, 3)
  const digits = seededRange(`${leaseId}:sysn`, 100, 999)
  return `${prefix}${digits}`
}

const SPEC: Partial<Record<KeyType, [number, number]>> = {
  LGH: [2, 5],
  PB: [1, 3],
  TP: [1, 3],
  GEM: [1, 3],
  // HUS, FS, HN left at 0 for now
}

const TYPE_SUFFIX: Partial<Record<KeyType, string>> = {
  PB: 'PB',
  TP: 'TP',
  GEM: 'GEM',
}

export function generateMockKeys(leaseId: string): Key[] {
  const keys: Key[] = []
  let counter = 1

  const base = baseCode(leaseId)
  const sys = systemCode(leaseId)

  ;(Object.keys(SPEC) as KeyType[]).forEach((type) => {
    const [min, max] = SPEC[type]!
    const count = seededRange(`${leaseId}:${type}:count`, min, max)

    const flexForType = seededRange(`${leaseId}:${type}:flex`, 1, 3)

    for (let i = 1; i <= count; i++) {
      const suffix = TYPE_SUFFIX[type] ?? ''
      const keyName = `${base}${suffix ? suffix : ''}-${i}`

      keys.push({
        id: `${type}-${counter}`,
        keyName,
        keyType: type as unknown as Key['keyType'],
        keySequenceNumber: i,
        flexNumber: flexForType,
        rentalObjectCode: base,
        keySystemId: sys as unknown as Key['keySystemId'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      counter++
    }
  })

  return keys
}

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
