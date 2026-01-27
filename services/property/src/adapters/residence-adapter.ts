import { Prisma } from '@prisma/client'
import { map } from 'lodash'
import { logger } from '@onecore/utilities'
import assert from 'node:assert'

import { trimStrings } from '@src/utils/data-conversion'
import {
  calculateMonthlyRentFromYearRentRows,
  calculateEstimatedHyresbortfall,
} from '../utils/rent-calculation'

import { prisma } from './db'
//todo: add types

/**
 * Builds a Prisma where clause for filtering rental blocks by active status.
 * - active=true: Not yet ended (toDate >= today OR toDate is null) - includes current and future blocks
 * - active=false: Already ended (toDate < today)
 * - active=undefined: No filter (all blocks)
 */
function buildActiveFilter(active?: boolean): Prisma.RentalBlockWhereInput {
  const now = new Date()

  if (active === true) {
    // Active: toDate >= today OR toDate is null (includes current and future blocks)
    return {
      OR: [{ toDate: { gte: now } }, { toDate: null }],
    }
  } else if (active === false) {
    // Inactive: toDate < today (already ended)
    return { toDate: { lt: now } }
  }
  return {}
}

/**
 * Sorts rental blocks: future blocks first (sorted by fromDate descending),
 * then current/active blocks (also sorted by fromDate descending).
 */
function sortRentalBlocksByFutureThenActive<
  T extends { fromDate: Date | string },
>(blocks: T[]): T[] {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  return [...blocks].sort((a, b) => {
    const fromA = new Date(a.fromDate)
    const fromB = new Date(b.fromDate)
    fromA.setHours(0, 0, 0, 0)
    fromB.setHours(0, 0, 0, 0)

    const aIsFuture = fromA > now
    const bIsFuture = fromB > now

    // Future blocks come first
    if (aIsFuture && !bIsFuture) return -1
    if (!aIsFuture && bIsFuture) return 1

    // Within same category, sort by fromDate descending (most recent/future first)
    return fromB.getTime() - fromA.getTime()
  })
}

export type Residence = Prisma.ResidenceGetPayload<{
  select: {
    id: true
    code: true
    name: true
    deleted: true
    fromDate: true
    toDate: true
  }
}>

export type ResidenceWithRelations = Prisma.ResidenceGetPayload<{
  include: {
    residenceType: true
    propertyObject: {
      include: {
        rentalInformation: { include: { rentalInformationType: true } }
        rentalBlocks: {
          include: {
            blockReason: true
          }
        }
        propertyStructures: {
          select: {
            rentalId: true
            propertyCode: true
            propertyName: true
            buildingCode: true
            buildingName: true
            staircaseCode: true
          }
        }
      }
    }
    comments: {
      where: {
        template: {
          type: 'balgh'
          caption: 'Anläggningsid'
        }
      }
      select: {
        text: true
      }
    }
  }
}>

const residenceSelect: Prisma.ResidenceSelect = {
  id: true,
  code: true,
  name: true,
  deleted: true,
  fromDate: true,
  toDate: true,
}

export const getResidenceByRentalId = async (rentalId: string) => {
  try {
    const propertyStructure = await prisma.propertyStructure.findFirst({
      where: {
        rentalId,
        propertyObject: { objectTypeId: 'balgh' },
      },
      select: {
        buildingCode: true,
        buildingName: true,
        propertyCode: true,
        propertyName: true,
        propertyId: true,
        buildingId: true,
        staircaseCode: true,
        rentalId: true,
        staircase: {
          select: {
            id: true,
            code: true,
            name: true,
            floorPlan: true,
            accessibleByElevator: true,
            deleteMark: true,
            fromDate: true,
            toDate: true,
            timestamp: true,
          },
        },
        propertyObject: {
          select: {
            rentalInformation: {
              select: {
                apartmentNumber: true,
                rentalInformationType: { select: { name: true, code: true } },
              },
            },
            residence: {
              select: {
                id: true,
                elevator: true,
                floor: true,
                deleted: true,
                code: true,
                hygieneFacility: true,
                name: true,
                wheelchairAccessible: true,
                residenceType: {
                  select: {
                    code: true,
                    name: true,
                    roomCount: true,
                    kitchen: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    assert(propertyStructure, 'property-structure-not-found')
    assert(propertyStructure.propertyObject, 'property-object-not-found')
    assert(propertyStructure.propertyObject.residence, 'residence-not-found')
    assert(
      propertyStructure.propertyObject.rentalInformation,
      'rentalinformation-not-found'
    )

    const {
      propertyObject: { residence, rentalInformation },
      staircase,
    } = propertyStructure

    return trimStrings({
      ...propertyStructure,
      propertyObject: { residence, rentalInformation },
      staircase,
    })
  } catch (err) {
    logger.error({ err }, 'residence-adapter.getResidenceByRentalId')
    throw err
  }
}

export const getResidenceById = async (
  id: string,
  options?: { active?: boolean }
): Promise<ResidenceWithRelations | null> => {
  const activeFilter = buildActiveFilter(options?.active)
  const hasActiveFilter = Object.keys(activeFilter).length > 0

  const response = await prisma.residence
    .findFirst({
      where: {
        id: id,
      },
      include: {
        residenceType: true,
        propertyObject: {
          include: {
            rentalInformation: { include: { rentalInformationType: true } },
            rentalBlocks: {
              ...(hasActiveFilter && { where: activeFilter }),
              include: {
                blockReason: true,
              },
            },
            propertyStructures: {
              select: {
                rentalId: true,
                buildingCode: true,
                buildingName: true,
                propertyCode: true,
                propertyName: true,
              },
            },
          },
        },
        comments: {
          where: {
            template: {
              type: 'balgh',
              caption: 'Anläggningsid',
            },
          },
          select: {
            text: true,
          },
        },
      },
    })
    .then(trimStrings)

  return response
}

export const getResidencesByBuildingCode = async (
  buildingCode: string
): Promise<Residence[]> => {
  const propertyStructures = await prisma.propertyStructure.findMany({
    where: {
      buildingCode: {
        contains: buildingCode,
      },
      NOT: {
        staircaseId: null,
        residenceId: null,
      },
      localeId: null,
    },
  })

  return prisma.residence
    .findMany({
      where: {
        propertyObjectId: {
          in: map(propertyStructures, 'propertyObjectId'),
        },
      },
      select: residenceSelect,
    })
    .then(trimStrings)
}

export const getResidencesByBuildingCodeAndStaircaseCode = async (
  buildingCode: string,
  staircaseCode: string
): Promise<Residence[]> => {
  const propertyStructures = await prisma.propertyStructure.findMany({
    where: {
      buildingCode: {
        contains: buildingCode,
      },
      staircaseCode: staircaseCode,
      NOT: {
        staircaseId: null,
        residenceId: null,
      },
      localeId: null,
    },
  })

  return prisma.residence
    .findMany({
      where: {
        propertyObjectId: {
          in: map(propertyStructures, 'propertyObjectId'),
        },
      },
    })
    .then(trimStrings)
}

export const getResidenceSummariesByBuildingCodeAndStaircaseCode = async (
  buildingCode: string,
  staircaseCode?: string
) => {
  const residences = await prisma.propertyStructure
    .findMany({
      select: {
        rentalId: true,
        buildingCode: true,
        buildingName: true,
        staircaseCode: true,
        staircaseName: true,
        propertyObject: {
          select: {
            /*
            rentalInformation: {
              select: {
                apartmentNumber: true,
                rentalInformationType: { select: { name: true, code: true } },
              },
            },
            */
            quantityValues: {
              where: {
                quantityTypeId: 'BOA',
              },
              select: {
                value: true,
                quantityTypeId: true,
                quantityType: { select: { name: true, unitId: true } },
              },
            },
            residence: {
              select: {
                id: true,
                elevator: true,
                floor: true,
                deleted: true,
                code: true,
                hygieneFacility: true,
                name: true,
                wheelchairAccessible: true,
                fromDate: true,
                toDate: true,
                residenceType: {
                  select: {
                    code: true,
                    name: true,
                    roomCount: true,
                    kitchen: true,
                  },
                },
              },
            },
          },
        },
      },
      where: {
        roomId: null,
        propertyObject: { objectTypeId: 'balgh' },
        buildingCode: {
          contains: buildingCode,
        },
        ...(staircaseCode && { staircaseCode: staircaseCode }),
        NOT: [{ staircaseId: null }, { residenceId: null }, { rentalId: null }],
        localeId: null,
      },
    })
    .then(trimStrings)

  return residences
}

export type ResidenceSearchResult = Prisma.ResidenceGetPayload<{
  include: {
    propertyObject: {
      include: {
        propertyStructures: {
          select: {
            rentalId: true
            propertyCode: true
            propertyName: true
            buildingCode: true
            buildingName: true
          }
        }
      }
    }
  }
}>

export const getResidenceSizeByRentalId = async (rentalId: string) => {
  try {
    // Get property structure information for the residence
    const propertyInfo = await prisma.propertyStructure.findFirst({
      where: {
        rentalId,
        propertyObject: { objectTypeId: 'balgh' },
        NOT: { propertyCode: null },
      },
      select: {
        name: true,
        propertyObject: {
          select: {
            id: true,
          },
        },
      },
    })

    if (propertyInfo === null) {
      logger.warn(
        'residence-adapter.getResidenceSizeByRentalId: No property structure found for rentalId'
      )
      return null
    }

    // Get area size for the property object
    const areaSize = await prisma.quantityValue.findFirst({
      where: {
        code: propertyInfo.propertyObject.id,
        quantityTypeId: 'BOA',
      },
    })

    return areaSize
  } catch (err) {
    logger.error({ err }, 'residence-adapter.getResidenceSizeById')
    throw err
  }
}

export const searchResidences = async (
  q: string,
  searchFields: string[]
): Promise<Array<ResidenceSearchResult>> => {
  try {
    const result = await prisma.residence.findMany({
      where: {
        propertyObject: {
          propertyStructures: {
            every: {
              OR: searchFields.map((field) => ({
                [field]: { contains: q },
              })),
            },
          },
        },
      },
      include: {
        propertyObject: {
          include: {
            propertyStructures: {
              select: {
                rentalId: true,
                propertyCode: true,
                propertyName: true,
                buildingCode: true,
                buildingName: true,
              },
              where: {
                NOT: {
                  rentalId: null,
                  propertyCode: null,
                  propertyName: null,
                  buildingCode: null,
                  buildingName: null,
                },
              },
            },
          },
        },
      },
    })

    return trimStrings(result)
  } catch (err) {
    logger.error({ err }, 'residence-adapter.searchResidences')
    throw err
  }
}

export const getRentalBlocksByRentalId = async (
  rentalId: string,
  options?: { active?: boolean }
) => {
  try {
    // First find the propertyObjectId from the rentalId
    const propertyStructure = await prisma.propertyStructure.findFirst({
      where: {
        rentalId,
        propertyObject: { objectTypeId: 'balgh' },
      },
      select: {
        propertyObjectId: true,
      },
    })

    if (!propertyStructure) {
      return null
    }

    const activeFilter = buildActiveFilter(options?.active)

    // Get rental blocks for this property object
    const rentalBlocks = await prisma.rentalBlock.findMany({
      where: {
        propertyObjectId: propertyStructure.propertyObjectId,
        ...activeFilter,
      },
      include: {
        blockReason: true,
      },
      orderBy: {
        fromDate: 'desc',
      },
    })

    return trimStrings(rentalBlocks)
  } catch (err) {
    logger.error({ err }, 'residence-adapter.getRentalBlocksByRentalId')
    throw err
  }
}

// Transform raw rental block data to API response format
// Moved from routes to keep transformation logic in adapter
function transformRentalBlock(rb: {
  id: string
  blockReasonId: string | null
  blockReason: { caption: string | null } | null
  fromDate: Date
  toDate: Date | null
  amount: number | null
  propertyStructure: {
    name: string | null
    rentalId: string | null
    propertyCode: string | null
    propertyName: string | null
    buildingCode: string | null
    buildingName: string | null
    residenceCode: string | null
    residenceName: string | null
    parkingSpaceCode: string | null
    parkingSpaceName: string | null
    localeCode: string | null
    localeName: string | null
    rentalObjectCode: string | null
    rentalObjectName: string | null
    administrativeUnit: {
      district: string | null
    } | null
    residence: {
      residenceType: {
        code: string | null
        name: string | null
        roomCount: number | null
      } | null
    } | null
  } | null
  rentRows: Array<{
    yearRent: number | null
    debitFromDate: Date | null
    debitToDate: Date | null
  }>
}) {
  const ps = rb.propertyStructure

  // Determine category based on which code field is populated (priority order)
  const getCategory = () => {
    if (ps?.residenceCode) return 'Bostad' as const
    if (ps?.parkingSpaceCode) return 'Bilplats' as const
    if (ps?.localeCode) return 'Lokal' as const
    if (ps?.rentalObjectCode) return 'Förråd' as const
    return 'Övrigt' as const
  }
  const category = getCategory()

  const monthlyRent = calculateMonthlyRentFromYearRentRows(rb.rentRows || [])
  const residenceType = ps?.residence?.residenceType

  return {
    id: rb.id,
    blockReasonId: rb.blockReasonId,
    blockReason: rb.blockReason?.caption || null,
    fromDate: rb.fromDate,
    toDate: rb.toDate,
    amount:
      rb.amount ??
      calculateEstimatedHyresbortfall(monthlyRent, rb.fromDate, rb.toDate),
    rentalObject: {
      code:
        ps?.residenceCode ||
        ps?.parkingSpaceCode ||
        ps?.localeCode ||
        ps?.rentalObjectCode ||
        null,
      name:
        ps?.residenceName ||
        ps?.parkingSpaceName ||
        ps?.localeName ||
        ps?.rentalObjectName ||
        null,
      category,
      address: ps?.name || null,
      rentalId: ps?.rentalId || null,
      monthlyRent,
      type: residenceType?.name || null,
    },
    building: {
      code: ps?.buildingCode || null,
      name: ps?.buildingName || null,
    },
    property: {
      code: ps?.propertyCode || null,
      name: ps?.propertyName || null,
    },
    distrikt: ps?.administrativeUnit?.district || null,
  }
}

/** Type for rent row data */
type RentRow = {
  yearRent: number | null
  debitFromDate: Date | null
  debitToDate: Date | null
}

async function fetchRentDataBatched(
  rentalIds: string[]
): Promise<Map<string, RentRow[]>> {
  if (rentalIds.length === 0) {
    return new Map()
  }

  const BATCH_SIZE = 2000
  const rentByRentalId = new Map<string, RentRow[]>()

  // Process in batches to avoid SQL Server 2100 parameter limit
  for (let i = 0; i < rentalIds.length; i += BATCH_SIZE) {
    const batch = rentalIds.slice(i, i + BATCH_SIZE)

    const rentData = await prisma.$queryRaw<
      Array<{
        rentalpropertyid: string
        yearrent: number | null
        debitfdate: Date | null
        debittodate: Date | null
      }>
    >`SELECT rentalpropertyid, yearrent, debitfdate, debittodate
       FROM hy_debitrowrentalproperty_xpand_api
       WHERE rentalpropertyid IN (${Prisma.join(batch)})`

    for (const row of rentData) {
      const id = row.rentalpropertyid.trim()
      if (!rentByRentalId.has(id)) {
        rentByRentalId.set(id, [])
      }
      rentByRentalId.get(id)!.push({
        yearRent: row.yearrent,
        debitFromDate: row.debitfdate,
        debitToDate: row.debittodate,
      })
    }
  }

  return rentByRentalId
}

/** Raw rental block row from SQL query with explicit JOINs */
interface RawRentalBlockRow {
  id: string
  blockReasonId: string | null
  blockReasonCaption: string | null
  fromDate: Date
  toDate: Date | null
  amount: number | null
  // PropertyStructure fields
  address: string | null
  rentalId: string | null
  propertyCode: string | null
  propertyName: string | null
  buildingCode: string | null
  buildingName: string | null
  residenceCode: string | null
  residenceName: string | null
  parkingSpaceCode: string | null
  parkingSpaceName: string | null
  localeCode: string | null
  localeName: string | null
  rentalObjectCode: string | null
  rentalObjectName: string | null
  // Joined fields
  district: string | null
  residenceTypeName: string | null
}

/**
 * Fetches rental blocks using raw SQL with explicit JOINs for better performance.
 * Used by export function only - paginated functions use Prisma ORM.
 */
async function fetchRentalBlocksRaw(
  options: RentalBlockFilterOptions
): Promise<RawRentalBlockRow[]> {
  const {
    q,
    fields = 'rentalId,address,blockReason',
    kategori,
    distrikt,
    blockReason,
    fastighet,
    fromDateGte,
    toDateLte,
    active,
  } = options

  // Build WHERE conditions
  const conditions: string[] = []

  // Base filter: must have a rentalId
  conditions.push("babuf.hyresid IS NOT NULL AND babuf.hyresid <> ''")

  // Active filter
  if (active === true) {
    conditions.push('(hyspt.tdate >= GETDATE() OR hyspt.tdate IS NULL)')
  } else if (active === false) {
    conditions.push('hyspt.tdate < GETDATE()')
  }

  // Distrikt filter
  if (distrikt) {
    conditions.push(`bafen.distrikt = ${escapeSqlString(distrikt)}`)
  }

  // Fastighet (property) filter
  if (fastighet) {
    conditions.push(`babuf.fstcaption = ${escapeSqlString(fastighet)}`)
  }

  // Block reason filter
  if (blockReason) {
    conditions.push(`hyspa.caption = ${escapeSqlString(blockReason)}`)
  }

  // Date range filters
  if (fromDateGte) {
    conditions.push(`hyspt.fdate >= ${escapeSqlString(fromDateGte)}`)
  }
  if (toDateLte) {
    conditions.push(`hyspt.tdate <= ${escapeSqlString(toDateLte)}`)
  }

  // Kategori filter
  if (kategori === 'Bostad') {
    conditions.push('babuf.lghcode IS NOT NULL')
  } else if (kategori === 'Bilplats') {
    conditions.push('babuf.bpscode IS NOT NULL')
  } else if (kategori === 'Lokal') {
    conditions.push('babuf.lokcode IS NOT NULL')
  } else if (kategori === 'Förråd') {
    conditions.push('babuf.hyrcode IS NOT NULL')
  } else if (kategori === 'Övrigt') {
    conditions.push(
      'babuf.lghcode IS NULL AND babuf.bpscode IS NULL AND babuf.lokcode IS NULL AND babuf.hyrcode IS NULL'
    )
  }

  // Search filter (q param) - OR across fields
  if (q && q.trim().length >= 2) {
    const searchTerm = q.trim()
    const searchFields = fields.split(',').map((f) => f.trim())
    const orClauses: string[] = []

    if (searchFields.includes('rentalId')) {
      orClauses.push(`babuf.hyresid LIKE ${escapeSqlLike(searchTerm)}`)
    }
    if (searchFields.includes('address')) {
      orClauses.push(`babuf.caption LIKE ${escapeSqlLike(searchTerm)}`)
    }
    if (searchFields.includes('blockReason')) {
      orClauses.push(`hyspa.caption LIKE ${escapeSqlLike(searchTerm)}`)
    }

    if (orClauses.length > 0) {
      conditions.push(`(${orClauses.join(' OR ')})`)
    }
  }

  const whereClause = conditions.join(' AND ')

  const rows = await prisma.$queryRawUnsafe<RawRentalBlockRow[]>(`
    SELECT
      hyspt.keyhyspt AS id,
      hyspt.keyhyspa AS blockReasonId,
      hyspa.caption AS blockReasonCaption,
      hyspt.fdate AS fromDate,
      hyspt.tdate AS toDate,
      hyspt.amount,
      babuf.caption AS address,
      babuf.hyresid AS rentalId,
      babuf.fstcode AS propertyCode,
      babuf.fstcaption AS propertyName,
      babuf.bygcode AS buildingCode,
      babuf.bygcaption AS buildingName,
      babuf.lghcode AS residenceCode,
      babuf.lghcaption AS residenceName,
      babuf.bpscode AS parkingSpaceCode,
      babuf.bpscaption AS parkingSpaceName,
      babuf.lokcode AS localeCode,
      babuf.lokcaption AS localeName,
      babuf.hyrcode AS rentalObjectCode,
      babuf.hyrcaption AS rentalObjectName,
      bafen.distrikt AS district,
      balgt.caption AS residenceTypeName
    FROM hyspt
    LEFT JOIN hyspa ON hyspt.keyhyspa = hyspa.keyhyspa
    LEFT JOIN babuf ON hyspt.keycmobj = babuf.keycmobj
    LEFT JOIN bafen ON babuf.keyobjfen = bafen.keybafen
    LEFT JOIN balgh ON babuf.keyobjlgh = balgh.keybalgh
    LEFT JOIN balgt ON balgh.keybalgt = balgt.keybalgt
    WHERE ${whereClause}
    ORDER BY hyspt.fdate DESC
  `)

  return rows
}

/** Escape a string value for safe SQL interpolation */
function escapeSqlString(value: string): string {
  // Escape single quotes by doubling them
  const escaped = value.replace(/'/g, "''")
  return `'${escaped}'`
}

/** Escape a string value for LIKE pattern with wildcards */
function escapeSqlLike(value: string): string {
  // Escape special LIKE characters and single quotes
  const escaped = value
    .replace(/'/g, "''")
    .replace(/%/g, '[%]')
    .replace(/_/g, '[_]')
  return `'%${escaped}%'`
}

/** Transform raw SQL row to API response format */
function transformRawRentalBlockRow(
  row: RawRentalBlockRow,
  rentRows: RentRow[]
) {
  const monthlyRent = calculateMonthlyRentFromYearRentRows(rentRows)

  const getCategory = () => {
    if (row.residenceCode) return 'Bostad' as const
    if (row.parkingSpaceCode) return 'Bilplats' as const
    if (row.localeCode) return 'Lokal' as const
    if (row.rentalObjectCode) return 'Förråd' as const
    return 'Övrigt' as const
  }

  return {
    id: row.id?.trim() || '',
    blockReasonId: row.blockReasonId?.trim() || null,
    blockReason: row.blockReasonCaption?.trim() || null,
    fromDate: row.fromDate,
    toDate: row.toDate,
    amount:
      row.amount ??
      calculateEstimatedHyresbortfall(monthlyRent, row.fromDate, row.toDate),
    rentalObject: {
      code:
        row.residenceCode?.trim() ||
        row.parkingSpaceCode?.trim() ||
        row.localeCode?.trim() ||
        row.rentalObjectCode?.trim() ||
        null,
      name:
        row.residenceName?.trim() ||
        row.parkingSpaceName?.trim() ||
        row.localeName?.trim() ||
        row.rentalObjectName?.trim() ||
        null,
      category: getCategory(),
      address: row.address?.trim() || null,
      rentalId: row.rentalId?.trim() || null,
      monthlyRent,
      type: row.residenceTypeName?.trim() || null,
    },
    building: {
      code: row.buildingCode?.trim() || null,
      name: row.buildingName?.trim() || null,
    },
    property: {
      code: row.propertyCode?.trim() || null,
      name: row.propertyName?.trim() || null,
    },
    distrikt: row.district?.trim() || null,
  }
}

export const getAllRentalBlocks = async (options?: {
  active?: boolean
  limit?: number
  offset?: number
}) => {
  try {
    const limit = options?.limit
    const offset = options?.offset
    const activeFilter = buildActiveFilter(options?.active)

    // Build where clause
    const whereClause = {
      // Filter for valid rental IDs at DB level
      propertyStructure: {
        rentalId: { not: '' },
      },
      ...activeFilter,
    }

    // Run count and data queries in parallel for better performance
    const [totalCount, rentalBlocks] = await Promise.all([
      prisma.rentalBlock.count({ where: whereClause }),
      prisma.rentalBlock.findMany({
        where: whereClause,
        include: {
          blockReason: true,
          propertyStructure: {
            select: {
              name: true, // Address
              rentalId: true, // Rental object code (Hyresobjekt)
              propertyCode: true, // Property code (Fastighet)
              propertyName: true, // Property name
              buildingCode: true, // Building code
              buildingName: true, // Building name
              residenceCode: true, // Residence code (for Bostad)
              residenceName: true, // Residence name
              parkingSpaceCode: true, // Parking space code (for Bilplats)
              parkingSpaceName: true, // Parking space name
              localeCode: true, // Locale code (for Lokal)
              localeName: true, // Locale name
              rentalObjectCode: true, // Rental object code (for Förråd)
              rentalObjectName: true, // Rental object name
              // Join to AdministrativeUnit (bafen) for distrikt
              administrativeUnit: {
                select: {
                  district: true,
                },
              },
              // Join to Residence -> ResidenceType for residence type info
              residence: {
                select: {
                  residenceType: {
                    select: {
                      code: true,
                      name: true, // e.g., "3 rum och kök"
                      roomCount: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          fromDate: 'desc',
        },
        ...(limit && { take: limit }),
        ...(offset && { skip: offset }),
      }),
    ])

    // Get unique rental IDs for fetching rent data
    const uniqueRentalIds = [
      ...new Set(
        rentalBlocks
          .map((rb) => rb.propertyStructure?.rentalId?.trim())
          .filter((id): id is string => !!id)
      ),
    ]

    // Fetch rent data using batched queries
    const rentByRentalId = await fetchRentDataBatched(uniqueRentalIds)

    // Attach rent data to rental blocks
    const rentalBlocksWithRent = rentalBlocks.map((rb) => {
      const rentalId = rb.propertyStructure?.rentalId?.trim()
      return {
        ...rb,
        rentRows: rentalId ? rentByRentalId.get(rentalId) || [] : [],
      }
    })

    const transformedBlocks = rentalBlocksWithRent.map(transformRentalBlock)
    const sortedBlocks = sortRentalBlocksByFutureThenActive(transformedBlocks)
    return {
      data: sortedBlocks,
      totalCount,
    }
  } catch (err) {
    logger.error({ err }, 'residence-adapter.getAllRentalBlocks')
    throw err
  }
}

interface RentalBlockFilterOptions {
  q?: string
  fields?: string
  kategori?: string
  distrikt?: string
  blockReason?: string
  fastighet?: string
  fromDateGte?: string
  toDateLte?: string
  active?: boolean
}

/**
 * Builds the Prisma where clause for rental block queries.
 * Used by both searchRentalBlocks and getAllRentalBlocksForExport to avoid duplication.
 */
function buildRentalBlockWhereClause(
  options: RentalBlockFilterOptions
): Prisma.RentalBlockWhereInput {
  const {
    q,
    fields = 'rentalId,address,blockReason',
    kategori,
    distrikt,
    blockReason,
    fastighet,
    fromDateGte,
    toDateLte,
    active,
  } = options

  const andConditions: Prisma.RentalBlockWhereInput[] = []

  // Base filter: must have a rentalId
  andConditions.push({
    propertyStructure: {
      rentalId: { not: '' },
    },
  })

  // Active filter
  const activeFilter = buildActiveFilter(active)
  if (Object.keys(activeFilter).length > 0) {
    andConditions.push(activeFilter)
  }

  // General search (q param) - OR across fields
  if (q && q.trim().length >= 2) {
    const searchTerm = q.trim()
    const searchFields = fields.split(',').map((f) => f.trim())

    const orConditions: Prisma.RentalBlockWhereInput[] = []

    for (const field of searchFields) {
      if (field === 'rentalId') {
        orConditions.push({
          propertyStructure: { rentalId: { contains: searchTerm } },
        })
      } else if (field === 'address') {
        orConditions.push({
          propertyStructure: { name: { contains: searchTerm } },
        })
      } else if (field === 'blockReason') {
        orConditions.push({
          blockReason: { caption: { contains: searchTerm } },
        })
      }
    }

    if (orConditions.length > 0) {
      andConditions.push({ OR: orConditions })
    }
  }

  // Distrikt filter (AND)
  if (distrikt) {
    andConditions.push({
      propertyStructure: {
        administrativeUnit: { district: distrikt },
      },
    })
  }

  // Fastighet (property) filter (AND)
  if (fastighet) {
    andConditions.push({
      propertyStructure: {
        propertyName: fastighet,
      },
    })
  }

  // Block reason filter (AND)
  if (blockReason) {
    andConditions.push({
      blockReason: { caption: blockReason },
    })
  }

  // Date range filters
  if (fromDateGte) {
    andConditions.push({
      fromDate: { gte: new Date(fromDateGte) },
    })
  }
  if (toDateLte) {
    andConditions.push({
      toDate: { lte: new Date(toDateLte) },
    })
  }

  // Kategori filter (derived from which code field is populated)
  if (kategori) {
    if (kategori === 'Bostad') {
      andConditions.push({
        propertyStructure: { residenceCode: { not: null } },
      })
    } else if (kategori === 'Bilplats') {
      andConditions.push({
        propertyStructure: { parkingSpaceCode: { not: null } },
      })
    } else if (kategori === 'Lokal') {
      andConditions.push({
        propertyStructure: { localeCode: { not: null } },
      })
    } else if (kategori === 'Förråd') {
      andConditions.push({
        propertyStructure: { rentalObjectCode: { not: null } },
      })
    } else if (kategori === 'Övrigt') {
      andConditions.push({
        propertyStructure: {
          residenceCode: null,
          parkingSpaceCode: null,
          localeCode: null,
          rentalObjectCode: null,
        },
      })
    }
  }

  return andConditions.length > 1
    ? { AND: andConditions }
    : andConditions[0] || {}
}

export interface SearchRentalBlocksOptions {
  q?: string
  fields?: string
  kategori?: string
  distrikt?: string
  blockReason?: string
  fastighet?: string
  fromDateGte?: string
  toDateLte?: string
  active?: boolean
  limit?: number
  offset?: number
}

export const searchRentalBlocks = async (
  options: SearchRentalBlocksOptions
) => {
  try {
    const { limit, offset } = options

    const whereClause = buildRentalBlockWhereClause(options)

    // Run count and data queries in parallel for better performance
    const [totalCount, rentalBlocks] = await Promise.all([
      prisma.rentalBlock.count({ where: whereClause }),
      prisma.rentalBlock.findMany({
        where: whereClause,
        include: {
          blockReason: true,
          propertyStructure: {
            select: {
              name: true,
              rentalId: true,
              propertyCode: true,
              propertyName: true,
              buildingCode: true,
              buildingName: true,
              residenceCode: true,
              residenceName: true,
              parkingSpaceCode: true,
              parkingSpaceName: true,
              localeCode: true,
              localeName: true,
              rentalObjectCode: true,
              rentalObjectName: true,
              administrativeUnit: {
                select: {
                  district: true,
                },
              },
              residence: {
                select: {
                  residenceType: {
                    select: {
                      code: true,
                      name: true,
                      roomCount: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          fromDate: 'desc',
        },
        ...(limit && { take: limit }),
        ...(offset && { skip: offset }),
      }),
    ])

    // Get unique rental IDs for fetching rent data
    const uniqueRentalIds = [
      ...new Set(
        rentalBlocks
          .map((rb) => rb.propertyStructure?.rentalId?.trim())
          .filter((id): id is string => !!id)
      ),
    ]

    // Fetch rent data using batched queries
    const rentByRentalId = await fetchRentDataBatched(uniqueRentalIds)

    // Attach rent data to rental blocks
    const rentalBlocksWithRent = rentalBlocks.map((rb) => {
      const rentalId = rb.propertyStructure?.rentalId?.trim()
      return {
        ...rb,
        rentRows: rentalId ? rentByRentalId.get(rentalId) || [] : [],
      }
    })

    const transformedBlocks = rentalBlocksWithRent.map(transformRentalBlock)
    const sortedBlocks = sortRentalBlocksByFutureThenActive(transformedBlocks)
    return {
      data: sortedBlocks,
      totalCount,
    }
  } catch (err) {
    logger.error({ err }, 'residence-adapter.searchRentalBlocks')
    throw err
  }
}

export type ExportRentalBlocksOptions = RentalBlockFilterOptions

export const getAllRentalBlocksForExport = async (
  options: ExportRentalBlocksOptions
) => {
  try {
    // Fetch rental blocks using raw SQL with explicit JOINs
    const rawBlocks = await fetchRentalBlocksRaw(options)

    // Get unique rental IDs for fetching rent data
    const uniqueRentalIds = [
      ...new Set(
        rawBlocks
          .map((rb) => rb.rentalId?.trim())
          .filter((id): id is string => !!id)
      ),
    ]

    // Fetch rent data using batched queries
    const rentByRentalId = await fetchRentDataBatched(uniqueRentalIds)

    // Transform raw rows to API response format
    const transformedBlocks = rawBlocks.map((row) => {
      const rentalId = row.rentalId?.trim()
      const rentRows = rentalId ? rentByRentalId.get(rentalId) || [] : []
      return transformRawRentalBlockRow(row, rentRows)
    })

    return sortRentalBlocksByFutureThenActive(transformedBlocks)
  } catch (err) {
    logger.error({ err }, 'residence-adapter.getAllRentalBlocksForExport')
    throw err
  }
}

export const getAllBlockReasons = async () => {
  try {
    const blockReasons = await prisma.blockReason.findMany({
      orderBy: { caption: 'asc' },
    })
    return blockReasons.map(trimStrings)
  } catch (err) {
    logger.error({ err }, 'residence-adapter.getAllBlockReasons')
    throw err
  }
}

/**
 * Get distinct block reasons from actual rental blocks data.
 * This is more reliable than the lookup table as it only returns
 * block reasons that are actually in use.
 */
export const getDistinctBlockReasons = async () => {
  try {
    // Get distinct blockReasonIds from rental blocks
    const distinctIds = await prisma.rentalBlock.findMany({
      where: {
        blockReasonId: { not: null },
      },
      distinct: ['blockReasonId'],
      select: {
        blockReasonId: true,
      },
    })

    const blockReasonIds = distinctIds
      .map((r) => r.blockReasonId)
      .filter((id): id is string => id !== null)

    if (blockReasonIds.length === 0) {
      return []
    }

    // Fetch the actual block reason records
    const blockReasons = await prisma.blockReason.findMany({
      where: {
        id: { in: blockReasonIds },
      },
      orderBy: { caption: 'asc' },
      select: {
        id: true,
        caption: true,
      },
    })

    return blockReasons.map(trimStrings)
  } catch (err) {
    logger.error({ err }, 'residence-adapter.getDistinctBlockReasons')
    throw err
  }
}
