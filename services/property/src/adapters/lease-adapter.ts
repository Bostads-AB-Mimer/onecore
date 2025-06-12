import { prisma } from './db'

export async function getLeaseById(leaseId: string) {
  const lease = await prisma.contract.findFirst({
    where: {
      contractNumber: leaseId, // contractNumber is the same as leaseId, or hyobjben in xpand
    },
    include: {
      contractType: true,
    },
  })
  return lease
}
