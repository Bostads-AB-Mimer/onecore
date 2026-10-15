import { Prisma } from '@prisma/client'
import { logger } from '@onecore/utilities'

import { trimStrings } from '@src/utils/data-conversion'
import { openJsonList } from '@src/utils/sql'
import type { ResidenceBatchItem } from '@src/types/residence'

import { operatingCompanyFilter } from './company-scope'
import { prisma } from './db'

type Row = {
  rentalId: string
  code: string
  name: string | null
  apartmentNumber: string | null
  street: string | null
  street2: string | null
  postalCode: string | null
  city: string | null
  propertyCode: string | null
  propertyName: string | null
  buildingCode: string | null
  buildingName: string | null
  marketAreaCode: string | null
  marketAreaName: string | null
  residenceTypeCode: string | null
  residenceTypeName: string | null
  roomCount: number | null
  floor: string | null
  elevator: number | null
  area: number | Prisma.Decimal | null
}

const codeAndName = (code: string | null, name: string | null) =>
  code ? { code, name } : null

const toItem = (row: Row): ResidenceBatchItem => ({
  rentalId: row.rentalId,
  code: row.code,
  name: row.name,
  apartmentNumber: row.apartmentNumber,
  address: row.street
    ? {
        street: row.street,
        street2: row.street2,
        postalCode: row.postalCode,
        city: row.city,
      }
    : null,
  property: codeAndName(row.propertyCode, row.propertyName),
  building: codeAndName(row.buildingCode, row.buildingName),
  marketArea: codeAndName(row.marketAreaCode, row.marketAreaName),
  residenceType: row.residenceTypeCode
    ? {
        code: row.residenceTypeCode,
        name: row.residenceTypeName,
        roomCount: row.roomCount,
      }
    : null,
  floor: row.floor,
  elevator: row.elevator == null ? null : row.elevator !== 0,
  area: row.area == null ? null : Number(row.area),
})

/**
 * Residences by rental id, any count, in one query; unknown or non-residence
 * ids are absent. Every join is 1:1 on keycmobj except address and BOA, which
 * TOP 1 collapses so a duplicate source row cannot multiply results.
 */
export const getResidencesByRentalIds = async (
  rentalIds: string[]
): Promise<ResidenceBatchItem[]> => {
  const uniqueIds = Array.from(new Set(rentalIds))
  if (uniqueIds.length === 0) return []

  try {
    const rows = await prisma
      .$queryRaw<Row[]>(
        Prisma.sql`
          SELECT
            b.hyresid    AS rentalId,
            lg.code      AS code,
            lg.caption   AS name,
            hi.lmnr      AS apartmentNumber,
            a.adress1    AS street,
            a.adress2    AS street2,
            a.adress3    AS postalCode,
            a.adress4    AS city,
            b.fstcode    AS propertyCode,
            b.fstcaption AS propertyName,
            b.bygcode    AS buildingCode,
            b.bygcaption AS buildingName,
            ya.code      AS marketAreaCode,
            ya.caption   AS marketAreaName,
            gt.code      AS residenceTypeCode,
            gt.caption   AS residenceTypeName,
            gt.roomcount AS roomCount,
            lg.uppgang   AS floor,
            lg.hiss      AS elevator,
            boa.value    AS area
          FROM dbo.babuf b
          INNER JOIN dbo.balgh lg ON lg.keycmobj = b.keycmobj
          LEFT JOIN dbo.balgt gt ON gt.keybalgt = lg.keybalgt
          LEFT JOIN dbo.hyinf hi ON hi.keycmobj = b.keycmobj
          LEFT JOIN dbo.bafst fst ON fst.keycmobj = b.keyobjfst
          LEFT JOIN dbo.babya ya ON ya.keybabya = fst.keybabya
          OUTER APPLY (
            SELECT TOP 1 adr.adress1, adr.adress2, adr.adress3, adr.adress4
            FROM dbo.cmadr adr
            WHERE adr.keycode = b.keycmobj
              AND adr.keydbtbl = '_RQA11RNMA'
              AND adr.keycmtyp = 'adrpost'
          ) a
          OUTER APPLY (
            SELECT TOP 1 val.value
            FROM dbo.cmval val
            WHERE val.keycode = b.keycmobj
              AND val.keycmvat = 'BOA'
          ) boa
          WHERE b.deletemark = 0
            AND b.keycmobj = b.keyobjlgh
            AND ${operatingCompanyFilter('b.cmpcode')}
            AND b.hyresid IN ${openJsonList(uniqueIds)}
        `
      )
      .then(trimStrings)

    const seen = new Set<string>()
    const items: ResidenceBatchItem[] = []
    for (const row of rows) {
      if (seen.has(row.rentalId)) continue
      seen.add(row.rentalId)
      items.push(toItem(row))
    }
    return items
  } catch (err) {
    logger.error(
      { err, rentalIds: uniqueIds.length },
      'residence-batch-adapter.getResidencesByRentalIds'
    )
    throw err
  }
}
