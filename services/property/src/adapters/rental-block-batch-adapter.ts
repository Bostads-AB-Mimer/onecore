import { Prisma } from '@prisma/client'
import { logger } from '@onecore/utilities'

import { trimStrings } from '@src/utils/data-conversion'
import { openJsonList } from '@src/utils/sql'
import type { RentalBlock } from '@src/types/residence'

import { operatingCompanyFilter } from './company-scope'
import { prisma } from './db'

type Row = Omit<RentalBlock, 'amount'> & {
  amount: number | Prisma.Decimal | null
}

/**
 * Open rental blocks (not yet ended) for many rental ids in one query, reason
 * or not: a block without one still blocks. Raw SQL over an OPENJSON list:
 * the id set can exceed the 2,100-parameter cap a Prisma `in` hits.
 */
export const getOpenRentalBlocksByRentalIds = async (
  rentalIds: string[]
): Promise<RentalBlock[]> => {
  const uniqueIds = Array.from(new Set(rentalIds))
  if (uniqueIds.length === 0) return []

  try {
    const rows = await prisma
      .$queryRaw<Row[]>(
        Prisma.sql`
          SELECT
            hyspt.keyhyspt AS id,
            b.hyresid      AS rentalId,
            hyspt.keyhyspa AS blockReasonId,
            hyspa.caption  AS blockReason,
            hyspt.fdate    AS fromDate,
            hyspt.tdate    AS toDate,
            hyspt.amount   AS amount
          FROM dbo.hyspt
          LEFT JOIN dbo.hyspa ON hyspa.keyhyspa = hyspt.keyhyspa
          INNER JOIN dbo.babuf b ON b.keycmobj = hyspt.keycmobj
          WHERE b.deletemark = 0
            AND ${operatingCompanyFilter('b.cmpcode')}
            AND b.hyresid IN ${openJsonList(uniqueIds)}
            AND (hyspt.tdate IS NULL OR hyspt.tdate >= GETDATE())
        `
      )
      .then(trimStrings)
    return rows.map((row) => ({
      ...row,
      amount: row.amount == null ? null : Number(row.amount),
    }))
  } catch (err) {
    logger.error(
      { err, rentalIds: uniqueIds.length },
      'rental-block-batch-adapter.getOpenRentalBlocksByRentalIds'
    )
    throw err
  }
}
