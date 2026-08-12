import { Prisma } from '@prisma/client'
import { logger } from '@onecore/utilities'

import { trimStrings } from '@src/utils/data-conversion'
import type {
  RentalObjectSummary,
  RentalObjectType,
} from '@src/types/rental-object'

import { prisma } from './db'

type RentalObjectRow = {
  rentalId: string
  objectTypeId: string
  residenceCode: string | null
  residenceName: string | null
  parkingSpaceCode: string | null
  parkingSpaceName: string | null
  facilityCode: string | null
  facilityName: string | null
  rentalObjectCode: string | null
  rentalObjectName: string | null
  subtypeName: string | null
  buildingCode: string | null
  staircaseCode: string | null
  staircaseName: string | null
  parkingAreaCode: string | null
  address: string | null
}

// The four rentable object types. babuf rows for rooms/components inherit
// their parent's hyresid, so keycmobt is the authoritative filter — not
// hyresid alone.
const TYPE_BY_KEYCMOBT: Record<string, RentalObjectType> = {
  balgh: 'residence',
  babps: 'parkingSpace',
  balok: 'facility',
  bahyr: 'other',
}

const codeAndName = (
  type: RentalObjectType,
  row: RentalObjectRow
): { code: string | null; name: string | null } => {
  switch (type) {
    case 'residence':
      return { code: row.residenceCode, name: row.residenceName }
    case 'parkingSpace':
      return { code: row.parkingSpaceCode, name: row.parkingSpaceName }
    case 'facility':
      return { code: row.facilityCode, name: row.facilityName }
    case 'other':
      return { code: row.rentalObjectCode, name: row.rentalObjectName }
  }
}

/**
 * All rental objects of one property or one building, as flat structure rows
 * from babuf: type, code/name, subtype caption, postal address and
 * building/staircase placement.
 */
export const getRentalObjects = async (scope: {
  propertyCode?: string
  buildingCode?: string
  exclude?: RentalObjectType[]
}): Promise<RentalObjectSummary[]> => {
  try {
    const scopeSql = scope.propertyCode
      ? Prisma.sql`b.fstcode = ${scope.propertyCode}`
      : Prisma.sql`b.bygcode = ${scope.buildingCode}`

    const rows = await prisma
      .$queryRaw<RentalObjectRow[]>(
        Prisma.sql`
          SELECT DISTINCT
            b.hyresid    AS rentalId,
            o.keycmobt   AS objectTypeId,
            b.lghcode    AS residenceCode,
            b.lghcaption AS residenceName,
            b.bpscode    AS parkingSpaceCode,
            b.bpscaption AS parkingSpaceName,
            b.lokcode    AS facilityCode,
            b.lokcaption AS facilityName,
            b.hyrcode    AS rentalObjectCode,
            b.hyrcaption AS rentalObjectName,
            COALESCE(gt.caption, pt.caption, lt.caption, ht.caption)
                         AS subtypeName,
            b.bygcode    AS buildingCode,
            b.vancode    AS staircaseCode,
            b.vancaption AS staircaseName,
            b.ytacode    AS parkingAreaCode,
            a.adress1    AS address
          FROM dbo.babuf b
          INNER JOIN dbo.cmobj o ON o.keycmobj = b.keycmobj
          LEFT JOIN dbo.balgh lg ON lg.keycmobj = b.keycmobj
          LEFT JOIN dbo.balgt gt ON gt.keybalgt = lg.keybalgt
          LEFT JOIN dbo.babps ps ON ps.keycmobj = b.keycmobj
          LEFT JOIN dbo.babpt pt ON pt.keybabpt = ps.keybabpt
          LEFT JOIN dbo.balok lk ON lk.keycmobj = b.keycmobj
          LEFT JOIN dbo.balot lt ON lt.keybalot = lk.keybalot
          LEFT JOIN dbo.bahyr hr ON hr.keycmobj = b.keycmobj
          LEFT JOIN dbo.bahyt ht ON ht.keybahyt = hr.keybahyt
          LEFT JOIN dbo.cmadr a
            ON a.keycode = b.keycmobj
           AND a.keydbtbl = '_RQA11RNMA'
           AND a.keycmtyp = 'adrpost'
          WHERE b.deletemark = 0
            AND b.hyresid IS NOT NULL
            AND b.hyresid NOT LIKE '%X'
            AND o.keycmobt IN ('balgh', 'babps', 'balok', 'bahyr')
            AND ${scopeSql}
          ORDER BY b.hyresid
        `
      )
      .then(trimStrings)

    const excluded = new Set(scope.exclude ?? [])
    const byRentalId = new Map<string, RentalObjectSummary>()
    for (const row of rows) {
      const type = TYPE_BY_KEYCMOBT[row.objectTypeId]
      if (!type || excluded.has(type) || byRentalId.has(row.rentalId)) continue
      byRentalId.set(row.rentalId, {
        rentalId: row.rentalId,
        type,
        ...codeAndName(type, row),
        subtypeName: row.subtypeName ?? null,
        address: row.address ?? null,
        buildingCode: row.buildingCode ?? null,
        staircaseCode: row.staircaseCode ?? null,
        staircaseName: row.staircaseName ?? null,
        parkingAreaCode: row.parkingAreaCode ?? null,
      })
    }
    return [...byRentalId.values()]
  } catch (err) {
    logger.error({ err, scope }, 'rental-object-adapter.getRentalObjects')
    throw err
  }
}
