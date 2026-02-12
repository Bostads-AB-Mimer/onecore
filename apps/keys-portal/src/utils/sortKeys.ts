import type { Key } from '@/services/types'

const KEY_TYPE_ORDER: string[] = ['HN', 'FS', 'LGH', 'PB', 'GAR', 'LOK']

export function sortKeys<T extends Key>(keys: T[]): T[] {
  return [...keys].sort((a, b) => {
    // 1. Disposed (non-disposed first)
    if ((a.disposed ?? false) !== (b.disposed ?? false)) {
      return (a.disposed ?? false) ? 1 : -1
    }

    // 2. Key type (priority order, then alphabetical)
    const aTypeIdx = KEY_TYPE_ORDER.indexOf(a.keyType)
    const bTypeIdx = KEY_TYPE_ORDER.indexOf(b.keyType)
    const aType = aTypeIdx === -1 ? KEY_TYPE_ORDER.length : aTypeIdx
    const bType = bTypeIdx === -1 ? KEY_TYPE_ORDER.length : bTypeIdx
    if (aType !== bType) return aType - bType
    if (aTypeIdx === -1 && bTypeIdx === -1) {
      const cmp = a.keyType.localeCompare(b.keyType, 'sv')
      if (cmp !== 0) return cmp
    }

    // 3. Key system (group by keySystemId, nulls last)
    const aSys = a.keySystemId ?? ''
    const bSys = b.keySystemId ?? ''
    if (aSys !== bSys) {
      if (!aSys) return 1
      if (!bSys) return -1
      return aSys.localeCompare(bSys)
    }

    // 4. Rental object code (alphabetical, nulls last)
    const aCode = a.rentalObjectCode ?? ''
    const bCode = b.rentalObjectCode ?? ''
    if (aCode !== bCode) {
      if (!aCode) return 1
      if (!bCode) return -1
      return aCode.localeCompare(bCode, 'sv')
    }

    // 5. Key name
    const nameCmp = a.keyName.localeCompare(b.keyName, 'sv')
    if (nameCmp !== 0) return nameCmp

    // 6. Flex number (ascending, nulls last)
    const aFlex = a.flexNumber ?? Infinity
    const bFlex = b.flexNumber ?? Infinity
    if (aFlex !== bFlex) return aFlex - bFlex

    // 7. Sequence number (ascending, nulls last)
    const aSeq = a.keySequenceNumber ?? Infinity
    const bSeq = b.keySequenceNumber ?? Infinity
    return aSeq - bSeq
  })
}