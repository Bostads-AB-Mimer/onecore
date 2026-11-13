const normalise = (id: string) => id.trim().toLowerCase()

export const mergeTenfastFirst = <T extends { leaseId: string }>(
  tenfast: T[],
  xpand: T[]
): T[] => {
  const tenfastIds = new Set(tenfast.map((l) => normalise(l.leaseId)))
  return [
    ...tenfast,
    ...xpand.filter((l) => !tenfastIds.has(normalise(l.leaseId))),
  ]
}
