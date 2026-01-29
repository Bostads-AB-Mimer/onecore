import { Prisma } from '@prisma/client'
import { map } from 'lodash'
import { logger } from '@onecore/utilities'
import assert from 'node:assert'

import { trimStrings } from '@src/utils/data-conversion'
import {
  calculateYearlyRentFromYearRentRows,
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
        NOT: { rentalId: { endsWith: 'X' } },
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
      NOT: [
        { staircaseId: null, residenceId: null },
        { rentalId: { endsWith: 'X' } },
      ],
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
      NOT: [
        { staircaseId: null, residenceId: null },
        { rentalId: { endsWith: 'X' } },
      ],
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
        NOT: [
          { staircaseId: null },
          { residenceId: null },
          { rentalId: null },
          { rentalId: { endsWith: 'X' } },
        ],
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
            none: { rentalId: { endsWith: 'X' } },
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
function transformRentalBlock(
  rb: {
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
        id: string
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
  },
  fallbackDistrikt?: string | null
) {
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

  const yearlyRent = calculateYearlyRentFromYearRentRows(rb.rentRows || [])
  const residenceType = ps?.residence?.residenceType

  return {
    id: rb.id,
    blockReasonId: rb.blockReasonId,
    blockReason: rb.blockReason?.caption || null,
    fromDate: rb.fromDate,
    toDate: rb.toDate,
    amount:
      rb.amount ??
      calculateEstimatedHyresbortfall(yearlyRent, rb.fromDate, rb.toDate),
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
      residenceId: ps?.residence?.id || null,
      yearlyRent,
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
    distrikt: ps?.administrativeUnit?.district || fallbackDistrikt || null,
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

/**
 * Fetches district values by management unit code (fencode).
 * Used as fallback when the direct keyobjfen → keybafen join fails.
 */
async function fetchDistrictsByFencode(
  fencodes: string[]
): Promise<Map<string, string | null>> {
  if (fencodes.length === 0) return new Map()

  const results = await prisma.administrativeUnit.findMany({
    where: { code: { in: fencodes } },
    select: { code: true, district: true },
  })

  return new Map(
    results
      .filter((r) => r.code)
      .map((r) => [r.code!.trim(), r.district?.trim() || null])
  )
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
              managementUnitCode: true, // fencode - for fallback distrikt lookup
              // Join to AdministrativeUnit (bafen) for distrikt
              administrativeUnit: {
                select: {
                  district: true,
                },
              },
              // Join to Residence -> ResidenceType for residence type info
              residence: {
                select: {
                  id: true,
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

    // Fetch fallback distrikts for records missing district (via fencode → bafen.code)
    const fencodesMissingDistrikt = [
      ...new Set(
        rentalBlocks
          .filter((rb) => !rb.propertyStructure?.administrativeUnit?.district)
          .map((rb) => rb.propertyStructure?.managementUnitCode?.trim())
          .filter((code): code is string => !!code)
      ),
    ]
    const districtByFencode = await fetchDistrictsByFencode(
      fencodesMissingDistrikt
    )

    // Attach rent data to rental blocks
    const rentalBlocksWithRent = rentalBlocks.map((rb) => {
      const rentalId = rb.propertyStructure?.rentalId?.trim()
      return {
        ...rb,
        rentRows: rentalId ? rentByRentalId.get(rentalId) || [] : [],
      }
    })

    const transformedBlocks = rentalBlocksWithRent.map((rb) => {
      const fencode = rb.propertyStructure?.managementUnitCode?.trim()
      const fallbackDistrikt = fencode ? districtByFencode.get(fencode) : null
      return transformRentalBlock(rb, fallbackDistrikt)
    })
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

interface BuildRentalBlockWhereClauseOptions extends RentalBlockFilterOptions {}

/**
 * Builds the Prisma where clause for rental block queries.
 * Used by both searchRentalBlocks and getAllRentalBlocksForExport to avoid duplication.
 */
function buildRentalBlockWhereClause(
  options: BuildRentalBlockWhereClauseOptions
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

  // Distrikt filter - note: when distrikt is set, searchRentalBlocks uses raw SQL instead
  // This is kept as a simple fallback but the raw SQL path handles fencode correctly
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

/**
 * Searches rental blocks with distrikt filter using raw SQL.
 * Uses fencode → bafen.code join for district lookup (keyobjfen is redundant).
 * Applies ALL filters and pagination in SQL to avoid the 2100 parameter limit.
 * Returns paginated IDs and total count.
 */
async function searchRentalBlocksWithDistriktRaw(
  options: SearchRentalBlocksOptions
): Promise<{ ids: string[]; totalCount: number }> {
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
    limit,
    offset,
  } = options

  const conditions: string[] = []

  // Base filter: must have a rentalId
  conditions.push("babuf.hyresid IS NOT NULL AND babuf.hyresid <> ''")

  // Distrikt filter via fencode → bafen.code join
  if (distrikt) {
    conditions.push(`bafen.distrikt = ${escapeSqlString(distrikt)}`)
  }

  // Active filter
  if (active === true) {
    conditions.push('(hyspt.tdate >= GETDATE() OR hyspt.tdate IS NULL)')
  } else if (active === false) {
    conditions.push('hyspt.tdate < GETDATE()')
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

  // Get total count
  const countResult = await prisma.$queryRawUnsafe<Array<{ count: number }>>(`
    SELECT COUNT(*) AS count
    FROM hyspt
    LEFT JOIN hyspa ON hyspt.keyhyspa = hyspa.keyhyspa
    LEFT JOIN babuf ON hyspt.keycmobj = babuf.keycmobj
    LEFT JOIN bafen ON bafen.code = babuf.fencode
    WHERE ${whereClause}
  `)
  const totalCount = countResult[0]?.count ?? 0

  // Get paginated IDs with ordering
  const paginationClause =
    limit !== undefined
      ? `OFFSET ${offset ?? 0} ROWS FETCH NEXT ${limit} ROWS ONLY`
      : ''

  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`
    SELECT hyspt.keyhyspt AS id
    FROM hyspt
    LEFT JOIN hyspa ON hyspt.keyhyspa = hyspa.keyhyspa
    LEFT JOIN babuf ON hyspt.keycmobj = babuf.keycmobj
    LEFT JOIN bafen ON bafen.code = babuf.fencode
    WHERE ${whereClause}
    ORDER BY hyspt.fdate DESC
    ${paginationClause}
  `)

  return {
    ids: rows.map((r) => r.id.trim()),
    totalCount,
  }
}

// Shared include config for rental block queries
const rentalBlockInclude = {
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
      managementUnitCode: true,
      administrativeUnit: {
        select: {
          district: true,
        },
      },
      residence: {
        select: {
          id: true,
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
} as const

export const searchRentalBlocks = async (
  options: SearchRentalBlocksOptions
) => {
  try {
    const { limit, offset, distrikt } = options

    let totalCount: number
    let rentalBlocks: Awaited<
      ReturnType<
        typeof prisma.rentalBlock.findMany<{
          include: typeof rentalBlockInclude
        }>
      >
    >

    if (distrikt) {
      // When filtering by distrikt, use raw SQL to handle the COALESCE join logic
      // This applies ALL filters and pagination in SQL, returning only paginated IDs
      // to avoid SQL Server's 2100 parameter limit
      const result = await searchRentalBlocksWithDistriktRaw(options)
      totalCount = result.totalCount

      logger.info(
        { distrikt, totalCount, pageIds: result.ids.length },
        'searchRentalBlocks: found rental blocks for distrikt via fencode fallback'
      )

      if (result.ids.length === 0) {
        // No results, return empty
        return { data: [], totalCount: 0 }
      }

      // Fetch full data for just the paginated IDs (max 50-100, well under 2100 limit)
      rentalBlocks = await prisma.rentalBlock.findMany({
        where: { id: { in: result.ids } },
        include: rentalBlockInclude,
        orderBy: {
          fromDate: 'desc',
        },
      })
    } else {
      // No distrikt filter - use standard Prisma query
      const whereClause = buildRentalBlockWhereClause(options)

      // Run count and data queries in parallel for better performance
      const [count, blocks] = await Promise.all([
        prisma.rentalBlock.count({ where: whereClause }),
        prisma.rentalBlock.findMany({
          where: whereClause,
          include: rentalBlockInclude,
          orderBy: {
            fromDate: 'desc',
          },
          ...(limit && { take: limit }),
          ...(offset && { skip: offset }),
        }),
      ])

      totalCount = count
      rentalBlocks = blocks
    }

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

    // Fetch fallback distrikts for records missing district (via fencode → bafen.code)
    const fencodesMissingDistrikt = [
      ...new Set(
        rentalBlocks
          .filter((rb) => !rb.propertyStructure?.administrativeUnit?.district)
          .map((rb) => rb.propertyStructure?.managementUnitCode?.trim())
          .filter((code): code is string => !!code)
      ),
    ]
    const districtByFencode = await fetchDistrictsByFencode(
      fencodesMissingDistrikt
    )

    // Attach rent data to rental blocks
    const rentalBlocksWithRent = rentalBlocks.map((rb) => {
      const rentalId = rb.propertyStructure?.rentalId?.trim()
      return {
        ...rb,
        rentRows: rentalId ? rentByRentalId.get(rentalId) || [] : [],
      }
    })

    const transformedBlocks = rentalBlocksWithRent.map((rb) => {
      const fencode = rb.propertyStructure?.managementUnitCode?.trim()
      const fallbackDistrikt = fencode ? districtByFencode.get(fencode) : null
      return transformRentalBlock(rb, fallbackDistrikt)
    })
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
