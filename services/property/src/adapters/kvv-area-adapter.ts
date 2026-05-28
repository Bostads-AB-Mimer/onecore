import { logger } from '@onecore/utilities'

import { prisma } from './db'

export const findKvvAreaCodesByResponsibles = async (
  userIds: string[]
): Promise<string[]> => {
  if (userIds.length === 0) return []
  try {
    const rows = await prisma.onecoreKvvArea.findMany({
      where: { responsibleKeycloakUserId: { in: userIds } },
      select: { code: true },
    })
    return rows.map((r) => r.code)
  } catch (err) {
    logger.error({ err }, 'kvv-area-adapter.findKvvAreaCodesByResponsibles')
    throw err
  }
}
