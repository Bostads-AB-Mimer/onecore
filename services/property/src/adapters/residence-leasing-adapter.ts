import { Prisma } from '@prisma/client'
import { logger } from '@onecore/utilities'

import { trimStrings } from '@src/utils/data-conversion'
import { openJsonList } from '@src/utils/sql'
import type { ResidenceLeasingDetails } from '@src/types/rental-object'

import { operatingCompanyFilter } from './company-scope'
import { prisma } from './db'

type ResidenceLeasingRow = {
  rentalId: string
  propertyObjectId: string
  address: string | null
  apartmentNumber: string | null
  propertyCode: string | null
  propertyName: string | null
  buildingCode: string | null
  marketAreaCode: string | null
  marketAreaName: string | null
  residenceTypeCode: string | null
  residenceTypeName: string | null
  roomCount: number | null
  floor: string | null
  elevator: number | null
  area: number | Prisma.Decimal | null
}

/**
 * What the letting process needs about given residences, by rental id. Every
 * join is 1:1 on keycmobj except address and BRA, which are collapsed with
 * TOP 1 so a duplicate source row cannot multiply results.
 */
const fetchResidenceRows = async (
  rentalIds: string[]
): Promise<ResidenceLeasingRow[]> =>
  prisma
    .$queryRaw<ResidenceLeasingRow[]>(
      Prisma.sql`
        SELECT
          b.hyresid    AS rentalId,
          b.keycmobj   AS propertyObjectId,
          a.adress1    AS address,
          hi.lmnr      AS apartmentNumber,
          b.fstcode    AS propertyCode,
          b.fstcaption AS propertyName,
          b.bygcode    AS buildingCode,
          ya.code      AS marketAreaCode,
          ya.caption   AS marketAreaName,
          gt.code      AS residenceTypeCode,
          gt.caption   AS residenceTypeName,
          gt.roomcount AS roomCount,
          lg.uppgang   AS floor,
          lg.hiss      AS elevator,
          bra.value    AS area
        FROM dbo.babuf b
        INNER JOIN dbo.balgh lg ON lg.keycmobj = b.keycmobj
        LEFT JOIN dbo.balgt gt ON gt.keybalgt = lg.keybalgt
        LEFT JOIN dbo.hyinf hi ON hi.keycmobj = b.keycmobj
        LEFT JOIN dbo.bafst fst ON fst.keycmobj = b.keyobjfst
        LEFT JOIN dbo.babya ya ON ya.keybabya = fst.keybabya
        OUTER APPLY (
          SELECT TOP 1 adr.adress1
          FROM dbo.cmadr adr
          WHERE adr.keycode = b.keycmobj
            AND adr.keydbtbl = '_RQA11RNMA'
            AND adr.keycmtyp = 'adrpost'
        ) a
        OUTER APPLY (
          SELECT TOP 1 val.value
          FROM dbo.cmval val
          WHERE val.keycode = b.keycmobj
            AND val.keycmvat = 'BRA'
        ) bra
        WHERE b.deletemark = 0
          AND b.keycmobj = b.keyobjlgh
          AND ${operatingCompanyFilter('b.cmpcode')}
          AND b.hyresid IN ${openJsonList(rentalIds)}
      `
    )
    .then(trimStrings)

type BlockRow = {
  propertyObjectId: string
  fromDate: Date
  toDate: Date | null
  reason: string | null
}

/** Blocks not yet ended, per object. Raw SQL over an OPENJSON list: the id
 * set can be thousands, past the 2,100-parameter cap a Prisma `in` would hit. */
const fetchOpenBlocks = async (
  propertyObjectIds: string[]
): Promise<Map<string, BlockRow[]>> => {
  const out = new Map<string, BlockRow[]>()
  if (propertyObjectIds.length === 0) return out

  const blocks = await prisma
    .$queryRaw<BlockRow[]>(
      Prisma.sql`
        SELECT
          hyspt.keycmobj AS propertyObjectId,
          hyspt.fdate    AS fromDate,
          hyspt.tdate    AS toDate,
          hyspa.caption  AS reason
        FROM dbo.hyspt
        LEFT JOIN dbo.hyspa ON hyspa.keyhyspa = hyspt.keyhyspa
        WHERE hyspt.keycmobj IN ${openJsonList(propertyObjectIds)}
          AND (hyspt.tdate IS NULL OR hyspt.tdate >= GETDATE())
        ORDER BY hyspt.fdate DESC
      `
    )
    .then(trimStrings)

  for (const block of blocks) {
    const list = out.get(block.propertyObjectId) ?? []
    list.push(block)
    out.set(block.propertyObjectId, list)
  }
  return out
}

const toDetails = (
  row: ResidenceLeasingRow,
  blocks: BlockRow[]
): ResidenceLeasingDetails => ({
  rentalId: row.rentalId,
  address: row.address ?? null,
  apartmentNumber: row.apartmentNumber ?? null,
  propertyCode: row.propertyCode ?? null,
  propertyName: row.propertyName ?? null,
  buildingCode: row.buildingCode ?? null,
  marketAreaCode: row.marketAreaCode ?? null,
  marketAreaName: row.marketAreaName ?? null,
  residenceTypeCode: row.residenceTypeCode ?? null,
  residenceTypeName: row.residenceTypeName ?? null,
  roomCount: row.roomCount ?? null,
  floor: row.floor ?? null,
  elevator: row.elevator == null ? null : row.elevator !== 0,
  area: row.area == null ? null : Number(row.area),
  rentalBlocks: blocks.map((b) => ({
    fromDate: b.fromDate,
    toDate: b.toDate,
    reason: b.reason ?? null,
  })),
})

/**
 * Leasing details for the given residences, in no particular order. Unknown
 * or non-residence ids are simply absent from the result.
 */
export const getResidenceLeasingDetailsByRentalIds = async (
  rentalIds: string[]
): Promise<ResidenceLeasingDetails[]> => {
  const uniqueIds = Array.from(new Set(rentalIds))
  if (uniqueIds.length === 0) return []

  try {
    const rows = await fetchResidenceRows(uniqueIds)
    const blocksByObject = await fetchOpenBlocks(
      rows.map((r) => r.propertyObjectId)
    )

    const seen = new Set<string>()
    const details: ResidenceLeasingDetails[] = []
    for (const row of rows) {
      if (seen.has(row.rentalId)) continue
      seen.add(row.rentalId)
      details.push(
        toDetails(row, blocksByObject.get(row.propertyObjectId) ?? [])
      )
    }
    return details
  } catch (err) {
    logger.error(
      { err, rentalIds: uniqueIds.length },
      'residence-leasing-adapter.getResidenceLeasingDetailsByRentalIds'
    )
    throw err
  }
}
