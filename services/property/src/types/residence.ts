import { z } from 'zod'
import { createGenericResponseSchema } from './response'
import { StaircaseSchema } from './staircase'

// Boolean schema for rental block active filtering
const booleanStringSchema = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((val) => val === true || val === 'true')

export const residencesQueryParamsSchema = z.object({
  buildingCode: z
    .string({
      required_error: 'buildingCode query parameter is required',
      invalid_type_error: 'buildingCode must be a string',
    })
    .min(7, { message: 'buildingCode must be at least 7 characters long.' }),
  staircaseCode: z.string().optional(),
})

export const ResidenceSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  deleted: z.boolean(),
  validityPeriod: z.object({
    fromDate: z.date(),
    toDate: z.date(),
  }),
})

export const ResidenceSummarySchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string().nullable(),
  deleted: z.boolean(),
  rentalId: z.string(),
  buildingCode: z.string(),
  buildingName: z.string(),
  staircaseCode: z.string(),
  staircaseName: z.string(),
  elevator: z.number().nullable(),
  floor: z.string(),
  hygieneFacility: z.string().nullable(),
  wheelchairAccessible: z.number(),
  validityPeriod: z.object({
    fromDate: z.date().nullable(),
    toDate: z.date().nullable(),
  }),
  residenceType: z.object({
    code: z.string(),
    name: z.string(),
    roomCount: z.number(),
    kitchen: z.number(),
  }),
  quantityValues: z.array(
    z.object({
      value: z.number(),
      quantityTypeId: z.string(),
      quantityType: z.object({
        name: z.string(),
        unitId: z.string().nullable(),
      }),
    })
  ),
})

export const ResidenceSearchResultSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string().nullable(),
  deleted: z.boolean(),
  validityPeriod: z.object({
    fromDate: z.date(),
    toDate: z.date(),
  }),
  rentalId: z.string().nullable(),
  property: z.object({
    code: z.string().nullable(),
    name: z.string().nullable(),
  }),
  building: z.object({
    code: z.string().nullable(),
    name: z.string().nullable(),
  }),
})

export const ResidenceDetailedSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string().nullable(),
  location: z.string().nullable(),
  accessibility: z.object({
    wheelchairAccessible: z.boolean(),
    residenceAdapted: z.boolean(),
    elevator: z.boolean(),
  }),
  features: z.object({
    balcony1: z
      .object({
        location: z.string(),
        type: z.string(),
      })
      .optional(),
    balcony2: z
      .object({
        location: z.string(),
        type: z.string(),
      })
      .optional(),
    patioLocation: z.string().nullable(),
    hygieneFacility: z.string().nullable(),
    sauna: z.boolean(),
    extraToilet: z.boolean(),
    sharedKitchen: z.boolean(),
    petAllergyFree: z.boolean(),
    electricAllergyIntolerance: z
      .boolean()
      .describe('Is the apartment checked for electric allergy intolerance?'),
    smokeFree: z.boolean(),
    asbestos: z.boolean(),
  }),
  floor: z.string().nullable(),
  partNo: z.number().optional().nullable(),
  part: z.string().optional().nullable(),
  deleted: z.boolean(),
  validityPeriod: z.object({
    fromDate: z.date(),
    toDate: z.date(),
  }),
  residenceType: z.object({
    residenceTypeId: z.string(),
    code: z.string(),
    name: z.string().nullable(),
    roomCount: z.number().nullable(),
    kitchen: z.number(),
    systemStandard: z.number(),
    checklistId: z.string().nullable(),
    componentTypeActionId: z.string().nullable(),
    statisticsGroupSCBId: z.string().nullable(),
    statisticsGroup2Id: z.string().nullable(),
    statisticsGroup3Id: z.string().nullable(),
    statisticsGroup4Id: z.string().nullable(),
    timestamp: z.string(),
  }),
  propertyObject: z.object({
    energy: z.object({
      energyClass: z.number(),
      energyRegistered: z.date().optional(),
      energyReceived: z.date().optional(),
      energyIndex: z.number().optional(),
    }),
    rentalId: z.string().nullable(),
    rentalInformation: z
      .object({
        type: z.object({
          code: z.string(),
          name: z.string().nullable(),
        }),
      })
      .nullable(),
    rentalBlocks: z.array(
      z.object({
        id: z.string(),
        blockReasonId: z.string().nullable(),
        blockReason: z.string().nullable(),
        fromDate: z.date(),
        toDate: z.date().nullable(),
        amount: z.number().nullable(),
      })
    ),
  }),
  property: z.object({
    name: z.string().nullable(),
    code: z.string().nullable(),
  }),
  building: z.object({
    name: z.string().nullable(),
    code: z.string().nullable(),
  }),
  malarEnergiFacilityId: z.string().nullable(),
  size: z.number().nullable(),
})

export const ResidenceByRentalIdSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string().nullable(),
  accessibility: z.object({
    wheelchairAccessible: z.boolean(),
    elevator: z.boolean(),
  }),
  features: z.object({
    hygieneFacility: z.string().nullable(),
  }),
  entrance: z.string().nullable(),
  floor: z.string().nullable(),
  deleted: z.boolean(),
  type: z.object({
    code: z.string(),
    name: z.string().nullable(),
    roomCount: z.number().nullable(),
    kitchen: z.number(),
  }),
  rentalInformation: z
    .object({
      apartmentNumber: z.string().nullable(),
      rentalId: z.string().nullable(),
      type: z.object({
        code: z.string(),
        name: z.string().nullable(),
      }),
    })
    .nullable(),
  property: z.object({
    id: z.string().nullable(),
    name: z.string().nullable(),
    code: z.string().nullable(),
  }),
  building: z.object({
    id: z.string().nullable(),
    name: z.string().nullable(),
    code: z.string().nullable(),
  }),
  staircase: StaircaseSchema.nullable(),
  areaSize: z.number().nullable(),
})

export const GetResidenceByRentalIdResponseSchema = createGenericResponseSchema(
  ResidenceByRentalIdSchema
)

export const RentalBlockSchema = z.object({
  id: z.string(),
  blockReasonId: z.string().nullable(),
  blockReason: z.string().nullable(),
  fromDate: z.date(),
  toDate: z.date().nullable(),
  amount: z.number().nullable(),
})

export const RentalBlockWithRentalObjectSchema = z.object({
  id: z.string(),
  blockReasonId: z.string().nullable(),
  blockReason: z.string().nullable(),
  fromDate: z.date(),
  toDate: z.date().nullable(),
  amount: z.number().nullable(),
  distrikt: z.string().nullable(),
  rentalObject: z.object({
    code: z.string().nullable(),
    name: z.string().nullable(),
    category: z.enum(['Bostad', 'Bilplats', 'Lokal', 'Förråd', 'Övrigt']),
    address: z.string().nullable(),
    rentalId: z.string().nullable(),
    residenceId: z.string().nullable(),
    yearlyRent: z.number(),
    type: z.string().nullable(),
  }),
  building: z.object({
    code: z.string().nullable(),
    name: z.string().nullable(),
  }),
  property: z.object({
    code: z.string().nullable(),
    name: z.string().nullable(),
  }),
})

export const BlockReasonSchema = z.object({
  id: z.string(),
  caption: z.string(),
})

export const getAllRentalBlocksQueryParamsSchema = z.object({
  active: booleanStringSchema.optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(100),
})

// Helper for array-or-string params (supports multi-select filters)
// Normalizes to array, filters empty strings
const stringOrArraySchema = z
  .union([z.string(), z.array(z.string())])
  .transform((val) => {
    const asArray = Array.isArray(val) ? val : [val]
    const cleaned = asArray.map((v) => v.trim()).filter((v) => v !== '')
    return cleaned.length > 0 ? cleaned : undefined
  })
  .optional()

// Base filter schema (shared between search and export)
const rentalBlocksFilterSchema = z.object({
  q: z.string().optional(),
  kategori: stringOrArraySchema,
  distrikt: stringOrArraySchema,
  blockReason: stringOrArraySchema,
  fastighet: stringOrArraySchema,
  fromDateGte: z.string().optional(),
  toDateLte: z.string().optional(),
  active: booleanStringSchema.optional(),
})

// Search adds pagination
export const searchRentalBlocksQueryParamsSchema =
  rentalBlocksFilterSchema.extend({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(1000).optional().default(50),
  })

export type SearchRentalBlocksQueryParams = z.infer<
  typeof searchRentalBlocksQueryParamsSchema
>

// Export uses base filters only (no pagination)
export const exportRentalBlocksQueryParamsSchema = rentalBlocksFilterSchema

export type ExportRentalBlocksQueryParams = z.infer<
  typeof exportRentalBlocksQueryParamsSchema
>

export const GetRentalBlocksByRentalIdResponseSchema =
  createGenericResponseSchema(z.array(RentalBlockSchema))

export type ExternalResidence = z.infer<typeof ResidenceSchema>
export type Residence = ExternalResidence
export type ResidenceSearchResult = z.infer<typeof ResidenceSearchResultSchema>
export type ResidenceSummary = z.infer<typeof ResidenceSummarySchema>
export type GetResidenceByRentalIdResponse = z.infer<
  typeof GetResidenceByRentalIdResponseSchema
>
export type RentalBlock = z.infer<typeof RentalBlockSchema>
export type RentalBlockWithRentalObject = z.infer<
  typeof RentalBlockWithRentalObjectSchema
>
export type BlockReason = z.infer<typeof BlockReasonSchema>
export type GetRentalBlocksByRentalIdResponse = z.infer<
  typeof GetRentalBlocksByRentalIdResponseSchema
>
