import { logger } from '@onecore/utilities'

import { trimStrings } from '@src/utils/data-conversion'
import type { MarketArea } from '../types/market-area'

import { prisma } from './db'

// The id and code are trimmed: Xpand pads Char columns.
export const listMarketAreas = async (): Promise<MarketArea[]> => {
  try {
    const rows = await prisma.marketArea
      .findMany({
        select: { id: true, code: true, name: true },
        orderBy: { code: 'asc' },
      })
      .then(trimStrings)

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name ?? null,
    }))
  } catch (err) {
    logger.error({ err }, 'market-area-adapter.listMarketAreas')
    throw err
  }
}
