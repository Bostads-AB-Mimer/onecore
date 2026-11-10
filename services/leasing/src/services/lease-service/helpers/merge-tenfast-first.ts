import { Lease } from '@onecore/types'

export const mergeTenfastFirst = (
  tenfast: Lease[],
  xpand: Lease[]
): Lease[] => {
  const tenfastIds = new Set(tenfast.map((l) => l.leaseId.trim()))
  return [...tenfast, ...xpand.filter((l) => !tenfastIds.has(l.leaseId.trim()))]
}
