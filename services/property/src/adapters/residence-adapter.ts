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
  options?: { includeActiveBlocksOnly?: boolean }
): Promise<ResidenceWithRelations | null> => {
  const includeActiveBlocksOnly = options?.includeActiveBlocksOnly ?? false

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
              ...(includeActiveBlocksOnly && {
                where: {
                  fromDate: {
                    lte: new Date(),
                  },
                  OR: [
                    {
                      toDate: {
                        gte: new Date(),
                      },
                    },
                    {
                      toDate: null as any,
                    },
                  ],
                },
              }),
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
  options?: { includeActiveBlocksOnly?: boolean }
) => {
  try {
    const includeActiveBlocksOnly = options?.includeActiveBlocksOnly ?? false

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

    // Get rental blocks for this property object
    const rentalBlocks = await prisma.rentalBlock.findMany({
      where: {
        propertyObjectId: propertyStructure.propertyObjectId,
        ...(includeActiveBlocksOnly && {
          fromDate: {
            lte: new Date(),
          },
          OR: [
            {
              toDate: {
                gte: new Date(),
              },
            },
            {
              toDate: null as any,
            },
          ],
        }),
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

export const getAllRentalBlocks = async (options?: {
  includeActiveBlocksOnly?: boolean
  limit?: number
  offset?: number
}) => {
  try {
    const includeActiveBlocksOnly = options?.includeActiveBlocksOnly ?? false
    const limit = options?.limit
    const offset = options?.offset

    // Build where clause
    const whereClause = {
      // Filter for valid rental IDs at DB level
      propertyStructure: {
        rentalId: { not: '' },
      },
      ...(includeActiveBlocksOnly && {
        fromDate: { lte: new Date() },
        OR: [{ toDate: { gte: new Date() } }, { toDate: null }],
      }),
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

    // Fetch rent data for all rental IDs
    let rentByRentalId = new Map<
      string,
      Array<{
        yearRent: number | null
        debitFromDate: Date | null
        debitToDate: Date | null
      }>
    >()

    if (uniqueRentalIds.length > 0) {
      // Use parameterized query to prevent SQL injection
      const rentData = await prisma.$queryRaw<
        Array<{
          rentalpropertyid: string
          yearrent: number | null
          debitfdate: Date | null
          debittodate: Date | null
        }>
      >`SELECT rentalpropertyid, yearrent, debitfdate, debittodate
         FROM hy_debitrowrentalproperty_xpand_api
         WHERE rentalpropertyid IN (${Prisma.join(uniqueRentalIds)})`

      // Group rent rows by rental property ID
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

    // Attach rent data to rental blocks
    const rentalBlocksWithRent = rentalBlocks.map((rb) => {
      const rentalId = rb.propertyStructure?.rentalId?.trim()
      return {
        ...rb,
        rentRows: rentalId ? rentByRentalId.get(rentalId) || [] : [],
      }
    })

    const transformedBlocks = rentalBlocksWithRent.map(transformRentalBlock)
    return {
      data: transformedBlocks,
      totalCount,
    }
  } catch (err) {
    logger.error({ err }, 'residence-adapter.getAllRentalBlocks')
    throw err
  }
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
  includeActiveBlocksOnly?: boolean
  limit?: number
  offset?: number
}

export const searchRentalBlocks = async (
  options: SearchRentalBlocksOptions
) => {
  try {
    const {
      q,
      fields = 'rentalId,address,blockReason',
      kategori,
      distrikt,
      blockReason,
      fastighet,
      fromDateGte,
      toDateLte,
      includeActiveBlocksOnly = false,
      limit,
      offset,
    } = options

    // Build AND conditions array for proper query composition
    const andConditions: Prisma.RentalBlockWhereInput[] = []

    // Base filter: must have a rentalId
    andConditions.push({
      propertyStructure: {
        rentalId: { not: '' },
      },
    })

    // Active blocks filter
    if (includeActiveBlocksOnly) {
      andConditions.push({
        fromDate: { lte: new Date() },
        OR: [{ toDate: { gte: new Date() } }, { toDate: null }],
      })
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

    // Build final whereClause from AND conditions
    const whereClause: Prisma.RentalBlockWhereInput =
      andConditions.length > 1 ? { AND: andConditions } : andConditions[0] || {}

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

    // Fetch rent data for all rental IDs
    let rentByRentalId = new Map<
      string,
      Array<{
        yearRent: number | null
        debitFromDate: Date | null
        debitToDate: Date | null
      }>
    >()

    if (uniqueRentalIds.length > 0) {
      const rentData = await prisma.$queryRaw<
        Array<{
          rentalpropertyid: string
          yearrent: number | null
          debitfdate: Date | null
          debittodate: Date | null
        }>
      >`SELECT rentalpropertyid, yearrent, debitfdate, debittodate
         FROM hy_debitrowrentalproperty_xpand_api
         WHERE rentalpropertyid IN (${Prisma.join(uniqueRentalIds)})`

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

    // Attach rent data to rental blocks
    const rentalBlocksWithRent = rentalBlocks.map((rb) => {
      const rentalId = rb.propertyStructure?.rentalId?.trim()
      return {
        ...rb,
        rentRows: rentalId ? rentByRentalId.get(rentalId) || [] : [],
      }
    })

    const transformedBlocks = rentalBlocksWithRent.map(transformRentalBlock)
    return {
      data: transformedBlocks,
      totalCount,
    }
  } catch (err) {
    logger.error({ err }, 'residence-adapter.searchRentalBlocks')
    throw err
  }
}
