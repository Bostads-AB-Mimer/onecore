import { z } from 'zod'

// Xpand ID validation - variable length IDs (max 15 chars) from legacy system
const xpandIdSchema = z.string().max(15)

export const BuildingSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string().nullable(),
  buildingType: z.object({
    id: z.string().nullable(),
    code: z.string().nullable(),
    name: z.string().nullable(),
  }),
  construction: z.object({
    constructionYear: z.number().nullable(),
    renovationYear: z.number().nullable(),
    valueYear: z.number().nullable(),
  }),
  features: z.object({
    heating: z.string().nullable().optional(),
    fireRating: z.string().nullable().optional(),
  }),
  insurance: z.object({
    class: z.string().nullable(),
    value: z.number().nullable(),
  }),
  quantityValues: z
    .array(
      z.object({
        id: z.string(),
        value: z.number(),
        name: z.string(),
        unitId: z.string().nullable(),
      })
    )
    .optional(),
  deleted: z.boolean(),
  property: z
    .object({ name: z.string().nullable(), code: z.string(), id: z.string() })
    .nullish(),
})

export const CompanySchema = z.object({
  id: z.string(),
  propertyObjectId: z.string(),
  code: z.string(),
  name: z.string(),
  organizationNumber: z.string().nullable(),
})

export const CompanyDetailsSchema = z.object({
  id: z.string(),
  propertyObjectId: z.string(),
  code: z.string(),
  name: z.string(),
  organizationNumber: z.string().nullable(),
  phone: z.string().nullable(),
  fax: z.string().nullable(),
  vatNumber: z.string().nullable().optional(),
  internalExternal: z.number(),
  fTax: z.number(),
  cooperativeHousingAssociation: z.number(),
  differentiatedAdditionalCapital: z.number(),
  rentAdministered: z.number(),
  blocked: z.number(),
  rentDaysPerMonth: z.number(),
  economicPlanApproved: z.number(),
  vatObligationPercent: z.number(),
  vatRegistered: z.number(),
  energyOptimization: z.number(),
  ownedCompany: z.number(),
  interestInvoice: z.number(),
  errorReportAdministration: z.number(),
  mediaBilling: z.number(),
  ownResponsibilityForInternalMaintenance: z.number(),
  subletPercentage: z.number(),
  subletFeeAmount: z.number(),
  disableQuantitiesBelowCompany: z.number(),
  timestamp: z.string(),
})

export const PropertySchema = z.object({
  id: z.string(),
  propertyObjectId: z.string(),
  marketAreaId: z.string().nullable(),
  districtId: z.string().nullable(),
  propertyDesignationId: z.string().nullable(),
  valueAreaId: z.string().nullable(),
  code: z.string(),
  designation: z.string(),
  municipality: z.string(),
  tract: z.string(),
  block: z.string(),
  sector: z.string().nullable(),
  propertyIndexNumber: z.string().nullable(),
  congregation: z.string().nullable(),
  builtStatus: z.number(),
  separateAssessmentUnit: z.number(),
  consolidationNumber: z.string().nullable(),
  ownershipType: z.string(),
  registrationDate: z.string().nullable(),
  acquisitionDate: z.string().nullable(),
  isLeasehold: z.number(),
  leaseholdTerminationDate: z.string().nullable(),
  area: z.string().nullable(),
  purpose: z.string().nullable(),
  buildingType: z.string().nullable(),
  propertyTaxNumber: z.string().nullable(),
  mainPartAssessedValue: z.number(),
  includeInAssessedValue: z.number(),
  grading: z.number(),
  deleteMark: z.number(),
  fromDate: z.string().datetime(),
  toDate: z.string().datetime(),
  timestamp: z.string(),
})

export const PropertyDetailsSchema = z.object({
  id: z.string().trim(),
  propertyObjectId: z.string().trim(),
  marketAreaId: z.string().trim().nullable(),
  districtId: z.string().trim().nullable(),
  propertyDesignationId: z.string().trim().nullable(),
  valueAreaId: z.string().nullable(),
  code: z.string(),
  designation: z.string(),
  municipality: z.string(),
  tract: z.string(),
  block: z.string(),
  sector: z.string().nullable(),
  propertyIndexNumber: z.string().nullable(),
  congregation: z.string().nullable(),
  builtStatus: z.number().int(),
  separateAssessmentUnit: z.number().int(),
  consolidationNumber: z.string().nullable(),
  ownershipType: z.string(),
  registrationDate: z.string().nullable(),
  acquisitionDate: z.string().nullable(),
  isLeasehold: z.number().int(),
  leaseholdTerminationDate: z.string().nullable(),
  area: z.string().nullable(),
  purpose: z.string().nullable(),
  buildingType: z.string().nullable(),
  propertyTaxNumber: z.string().nullable(),
  mainPartAssessedValue: z.number().int(),
  includeInAssessedValue: z.number().int(),
  grading: z.number().int(),
  deleteMark: z.number().int(),
  fromDate: z.string(),
  toDate: z.string(),
  timestamp: z.string(),
  marketArea: z
    .object({
      id: z.string().trim(),
      code: z.string().trim(),
      name: z.string().trim(),
    })
    .nullable(),
  district: z
    .object({
      id: z.string().trim(),
      code: z.string().trim(),
      caption: z.string().trim(),
    })
    .nullable(),
  propertyObject: z.object({
    id: z.string().trim(),
    deleteMark: z.number().int(),
    timestamp: z.string(),
    objectTypeId: z.string().trim(),
    barcode: z.string().nullable(),
    barcodeType: z.number().int(),
    condition: z.number().int(),
    conditionInspectionDate: z.string().nullable(),
    vatAdjustmentPrinciple: z.number().int(),
    energyClass: z.number().int(),
    energyRegistered: z.string().nullable(),
    energyReceived: z.string().nullable(),
    energyIndex: z.string().nullable(),
    heatingNature: z.number().int(),
  }),
  propertyValues: z.array(
    z.object({
      value: z.number().nullable(),
      name: z.string(),
      unitId: z.string(),
    })
  ),
})

export const ResidenceSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  deleted: z.boolean(),
  validityPeriod: z.object({
    fromDate: z.string().datetime(),
    toDate: z.string().datetime(),
  }),
})

export const ResidenceDetailsSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string().nullable(),
  status: z.enum(['VACANT', 'LEASED']).nullable(),
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
    fromDate: z.coerce.date(),
    toDate: z.coerce.date(),
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
      energyRegistered: z.coerce.date().optional(),
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
        blockReasonId: z.string(),
        blockReason: z.string(),
        fromDate: z.coerce.date(),
        toDate: z.coerce.date().nullable(),
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

export const StaircaseSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string().nullable(),
  features: z.object({
    floorPlan: z.string().nullable(),
    accessibleByElevator: z.boolean(),
  }),
  dates: z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
  }),
  property: z
    .object({
      propertyId: z.string().nullable(),
      propertyName: z.string().nullable(),
      propertyCode: z.string().nullable(),
    })
    .optional(),
  building: z
    .object({
      buildingId: z.string().nullable(),
      buildingName: z.string().nullable(),
      buildingCode: z.string().nullable(),
    })
    .optional(),
  deleted: z.boolean(),
  timestamp: z.string().datetime(),
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

export const RoomTypeSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string().nullable(),
  use: z.number(),
  optionAllowed: z.number(),
  isSystemStandard: z.number(),
  allowSmallRoomsInValuation: z.number(),
  timestamp: z.string(),
})

export const RoomSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string().nullable(),
  usage: z.object({
    shared: z.boolean(),
    allowPeriodicWorks: z.boolean(),
    spaceType: z.number(),
  }),
  features: z.object({
    hasToilet: z.boolean(),
    isHeated: z.boolean(),
    hasThermostatValve: z.boolean(),
    orientation: z.number(),
  }),
  dates: z.object({
    installation: z.string().datetime().nullable(),
    from: z.string().datetime(),
    to: z.string().datetime(),
    availableFrom: z.string().datetime().nullable(),
    availableTo: z.string().datetime().nullable(),
  }),
  sortingOrder: z.number(),
  deleted: z.boolean(),
  timestamp: z.string(),
  roomType: RoomTypeSchema.nullable(),
})

export const ParkingSpaceSchema = z.object({
  rentalId: z.string(),
  companyCode: z.string(),
  companyName: z.string(),
  managementUnitCode: z.string(),
  managementUnitName: z.string(),
  propertyCode: z.string(),
  propertyName: z.string(),
  buildingCode: z.string().nullable(),
  buildingName: z.string().nullable(),
  parkingSpace: z.object({
    propertyObjectId: z.string(),
    code: z.string(),
    name: z.string(),
    parkingNumber: z.string(),
    parkingSpaceType: z.object({
      code: z.string(),
      name: z.string(),
    }),
  }),
  address: z.object({
    streetAddress: z.string().nullable(),
    streetAddress2: z.string().nullable(),
    postalCode: z.string().nullable(),
    city: z.string().nullable(),
  }),
})

export const MaintenanceUnitSchema = z.object({
  id: z.string(),
  rentalPropertyId: z.string().optional(),
  code: z.string(),
  caption: z.string().nullable(),
  type: z.string().nullable().optional(),
  estateCode: z.string().nullable(),
  estate: z.string().nullable(),
})

export const FacilityDetailsSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string().nullable(),
  entrance: z.string().nullable(),
  deleted: z.boolean(),
  type: z.object({
    code: z.string(),
    name: z.string().nullable(),
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
  areaSize: z.number().nullable(),
})

export const GetRoomsQueryParamsSchema = z.object({
  residenceId: z.string().min(1, { message: 'residenceId is required.' }),
})

export const GetBuildingsQueryParamsSchema = z.object({
  propertyCode: z.string().min(1, { message: 'propertyCode is required.' }),
})

export const GetResidencesQueryParamsSchema = z.object({
  buildingCode: z.string(),
  staircaseCode: z.string().optional(),
})

export const GetPropertiesQueryParamsSchema = z.object({
  companyCode: z.string(),
  tract: z.string().optional(),
})

export const StaircasesQueryParamsSchema = z.object({
  buildingCode: z
    .string()
    .min(7, { message: 'buildingCode must be at least 7 characters long.' }),
})

export const ResidenceSummaryQueryParamsSchema = z.object({
  staircaseCode: z.string().optional(),
})

export const GetResidenceDetailsQueryParamsSchema = z.object({
  includeActiveBlocksOnly: z
    .string()
    .optional()
    .transform((val) => val === 'true')
    .default('false'),
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
    fromDate: z.string().datetime().nullable(),
    toDate: z.string().datetime().nullable(),
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

export type Building = z.infer<typeof BuildingSchema>
export type Company = z.infer<typeof CompanySchema>
export type Property = z.infer<typeof PropertySchema>
export type PropertyDetails = z.infer<typeof PropertyDetailsSchema>
export type Residence = z.infer<typeof ResidenceSchema>
export type ResidenceDetails = z.infer<typeof ResidenceDetailsSchema>
export type ResidenceByRentalIdDetails = z.infer<
  typeof ResidenceByRentalIdSchema
>
export type ResidenceSummary = z.infer<typeof ResidenceSummarySchema>
export type Staircase = z.infer<typeof StaircaseSchema>
export type RoomType = z.infer<typeof RoomTypeSchema>
export type Room = z.infer<typeof RoomSchema>
export type ParkingSpace = z.infer<typeof ParkingSpaceSchema>
export type MaintenanceUnit = z.infer<typeof MaintenanceUnitSchema>
export type FacilityDetails = z.infer<typeof FacilityDetailsSchema>

// ==================== COMPONENTS NEW ====================

export const QuantityTypeEnum = z.enum([
  'UNIT',
  'METER',
  'SQUARE_METER',
  'CUBIC_METER',
])

export const ComponentStatusEnum = z.enum([
  'ACTIVE',
  'INACTIVE',
  'MAINTENANCE',
  'DECOMMISSIONED',
])

export const SpaceTypeEnum = z.enum(['OBJECT'])

// Component Category Schema (Level 1)
export const ComponentCategorySchema = z.object({
  id: z.string().uuid(),
  categoryName: z.string(),
  description: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

// Component Type Schema (Level 2)
export const ComponentTypeSchema = z.object({
  id: z.string().uuid(),
  typeName: z.string(),
  categoryId: z.string().uuid(),
  description: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  category: ComponentCategorySchema.optional(),
})

// Component Subtype Schema (Level 3)
export const ComponentSubtypeSchema = z.object({
  id: z.string().uuid(),
  subTypeName: z.string(),
  typeId: z.string().uuid(),
  xpandCode: z.string().nullable(),
  depreciationPrice: z.number().min(0),
  technicalLifespan: z.number().min(0),
  economicLifespan: z.number().min(0),
  replacementIntervalMonths: z.number().int().min(0),
  quantityType: QuantityTypeEnum,
  createdAt: z.string(),
  updatedAt: z.string(),
  componentType: ComponentTypeSchema.optional(),
})

// Component Model Schema (Level 4)
export const ComponentModelSchema = z.object({
  id: z.string().uuid(),
  modelName: z.string(),
  componentSubtypeId: z.string().uuid(),
  currentPrice: z.number().min(0),
  currentInstallPrice: z.number().min(0),
  warrantyMonths: z.number().int().min(0),
  manufacturer: z.string(),
  technicalSpecification: z.string().nullable(),
  installationInstructions: z.string().nullable(),
  dimensions: z.string().nullable(),
  coclassCode: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  subtype: ComponentSubtypeSchema.optional(),
})

export const ComponentInstallationWithoutComponentSchema = z.object({
  id: z.string().uuid(),
  componentId: z.string().uuid(),
  spaceId: z.string().nullable(),
  spaceType: SpaceTypeEnum,
  installationDate: z.string(),
  deinstallationDate: z.string().nullable(),
  orderNumber: z.string().nullable().optional(),
  cost: z.number().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
})

// Component instance schema with installations included (Level 5)
// The componentInstallations field uses the "WithoutComponent" version to break circular reference
export const ComponentNewSchema = z.object({
  id: z.string().uuid(),
  modelId: z.string().uuid(),
  serialNumber: z.string(),
  specifications: z.string().nullable().optional(),
  additionalInformation: z.string().nullable().optional(),
  warrantyStartDate: z.string().nullable(),
  warrantyMonths: z.number().int().min(0),
  priceAtPurchase: z.number().min(0),
  depreciationPriceAtPurchase: z.number().min(0),
  ncsCode: z.string().nullable().optional(),
  status: ComponentStatusEnum,
  quantity: z.number().min(0),
  economicLifespan: z.number().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
  model: ComponentModelSchema.optional(),
  componentInstallations: z
    .array(ComponentInstallationWithoutComponentSchema)
    .optional(),
})

export const ComponentInstallationSchema = z.object({
  id: z.string().uuid(),
  componentId: z.string().uuid(),
  spaceId: z.string().nullable(),
  spaceType: SpaceTypeEnum,
  installationDate: z.string(),
  deinstallationDate: z.string().nullable(),
  orderNumber: z.string().nullable().optional(),
  cost: z.number().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
  component: ComponentNewSchema.optional(),
})

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(
  itemSchema: T
) =>
  z.object({
    content: z.array(itemSchema),
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }),
  })

export const ComponentCategoriesQueryParamsSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

export const ComponentTypesQueryParamsSchema = z.object({
  categoryId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

export const ComponentSubtypesQueryParamsSchema = z.object({
  typeId: z.string().uuid().optional(),
  subtypeName: z.string().optional(), // Search parameter
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

export const ComponentModelsQueryParamsSchema = z.object({
  componentTypeId: z.string().uuid().optional(),
  subtypeId: z.string().uuid().optional(),
  manufacturer: z.string().optional(),
  modelName: z.string().optional(), // Search parameter
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

export const ComponentsNewQueryParamsSchema = z.object({
  modelId: z.string().uuid().optional(),
  status: ComponentStatusEnum.optional(),
  serialNumber: z.string().optional(), // Search parameter
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

export const ComponentInstallationsQueryParamsSchema = z.object({
  componentId: z.string().uuid().optional(),
  spaceId: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

export const CreateComponentCategorySchema = z.object({
  categoryName: z.string().trim().min(1, 'Category name is required'),
  description: z.string().trim().min(1, 'Description is required'),
})

export const UpdateComponentCategorySchema = z.object({
  categoryName: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
})

export const CreateComponentTypeSchema = z.object({
  typeName: z.string().trim().min(1, 'Type name is required'),
  categoryId: z.string().uuid(),
  description: z.string().trim().min(1, 'Description is required'),
})

export const UpdateComponentTypeSchema = z.object({
  typeName: z.string().trim().min(1).optional(),
  categoryId: z.string().uuid().optional(),
  description: z.string().trim().min(1).optional(),
})

export const CreateComponentSubtypeSchema = z.object({
  subTypeName: z.string().trim().min(1, 'Subtype name is required'),
  typeId: z.string().uuid(),
  xpandCode: z.string().trim().optional(),
  depreciationPrice: z.number().min(0),
  technicalLifespan: z.number().min(0),
  economicLifespan: z.number().min(0),
  replacementIntervalMonths: z.number().int().min(0),
  quantityType: QuantityTypeEnum,
})

export const UpdateComponentSubtypeSchema = z.object({
  subTypeName: z.string().trim().min(1).optional(),
  typeId: z.string().uuid().optional(),
  xpandCode: z.string().trim().min(1).optional(),
  depreciationPrice: z.number().min(0).optional(),
  technicalLifespan: z.number().min(0).optional(),
  economicLifespan: z.number().min(0).optional(),
  replacementIntervalMonths: z.number().int().min(0).optional(),
  quantityType: QuantityTypeEnum.optional(),
})

export const CreateComponentModelSchema = z.object({
  modelName: z.string().trim().min(1, 'Model name is required'),
  componentSubtypeId: z.string().uuid(),
  currentPrice: z.number().min(0),
  currentInstallPrice: z.number().min(0),
  warrantyMonths: z.number().int().min(0),
  manufacturer: z.string().trim().min(1, 'Manufacturer is required'),
  technicalSpecification: z.string().trim().optional(),
  installationInstructions: z.string().trim().optional(),
  dimensions: z.string().trim().optional(),
  coclassCode: z.string().trim().optional(),
})

export const UpdateComponentModelSchema = z.object({
  modelName: z.string().trim().min(1).optional(),
  componentSubtypeId: z.string().uuid().optional(),
  currentPrice: z.number().min(0).optional(),
  currentInstallPrice: z.number().min(0).optional(),
  warrantyMonths: z.number().int().min(0).optional(),
  manufacturer: z.string().trim().min(1).optional(),
  technicalSpecification: z.string().trim().optional(),
  installationInstructions: z.string().trim().optional(),
  dimensions: z.string().trim().optional(),
  coclassCode: z.string().trim().optional(),
})

export const CreateComponentNewSchema = z.object({
  modelId: z.string().uuid(),
  serialNumber: z.string().trim().min(1, 'Serial number is required'),
  specifications: z.string().trim().optional(),
  additionalInformation: z.string().trim().optional(),
  warrantyStartDate: z.coerce.date().optional(),
  warrantyMonths: z.number().int().min(0),
  priceAtPurchase: z.number().min(0),
  depreciationPriceAtPurchase: z.number().min(0),
  ncsCode: z
    .string()
    .trim()
    .regex(/^\d{3}(\.\d{3})?$/, 'Invalid NCS code format')
    .optional(),
  status: ComponentStatusEnum.optional().default('ACTIVE'),
  quantity: z.number().min(0).default(1),
  economicLifespan: z.number().min(0),
  files: z.string().trim().optional(),
})

export const UpdateComponentNewSchema = z.object({
  modelId: z.string().uuid().optional(),
  serialNumber: z.string().trim().min(1).optional(),
  specifications: z.string().trim().optional(),
  additionalInformation: z.string().trim().optional(),
  warrantyStartDate: z.coerce.date().optional(),
  warrantyMonths: z.number().int().min(0).optional(),
  priceAtPurchase: z.number().min(0).optional(),
  depreciationPriceAtPurchase: z.number().min(0).optional(),
  ncsCode: z
    .string()
    .trim()
    .regex(/^\d{3}(\.\d{3})?$/, 'Invalid NCS code format')
    .optional(),
  status: ComponentStatusEnum.optional(),
  quantity: z.number().min(0).optional(),
  economicLifespan: z.number().min(0).optional(),
  files: z.string().trim().optional(),
})

export const CreateComponentInstallationSchema = z.object({
  componentId: z.string().uuid(),
  spaceId: z.string().optional(),
  spaceType: SpaceTypeEnum,
  installationDate: z.coerce.date(),
  deinstallationDate: z.coerce.date().optional(),
  orderNumber: z.string().trim().optional(),
  cost: z.number().min(0),
})

export const UpdateComponentInstallationSchema = z.object({
  componentId: z.string().uuid().optional(),
  spaceId: z.string().optional(),
  spaceType: SpaceTypeEnum.optional(),
  installationDate: z.coerce.date().optional(),
  deinstallationDate: z.coerce.date().optional(),
  orderNumber: z.string().trim().optional(),
  cost: z.number().min(0).optional(),
})

export type ComponentCategory = z.infer<typeof ComponentCategorySchema>
export type ComponentType = z.infer<typeof ComponentTypeSchema>
export type ComponentSubtype = z.infer<typeof ComponentSubtypeSchema>
export type ComponentModel = z.infer<typeof ComponentModelSchema>
export type ComponentNew = z.infer<typeof ComponentNewSchema>
export type ComponentInstallation = z.infer<typeof ComponentInstallationSchema>
export type CreateComponentCategory = z.infer<
  typeof CreateComponentCategorySchema
>
export type UpdateComponentCategory = z.infer<
  typeof UpdateComponentCategorySchema
>
export type CreateComponentType = z.infer<typeof CreateComponentTypeSchema>
export type UpdateComponentType = z.infer<typeof UpdateComponentTypeSchema>
export type CreateComponentSubtype = z.infer<
  typeof CreateComponentSubtypeSchema
>
export type UpdateComponentSubtype = z.infer<
  typeof UpdateComponentSubtypeSchema
>
export type CreateComponentModel = z.infer<typeof CreateComponentModelSchema>
export type UpdateComponentModel = z.infer<typeof UpdateComponentModelSchema>
export type CreateComponentNew = z.infer<typeof CreateComponentNewSchema>
export type UpdateComponentNew = z.infer<typeof UpdateComponentNewSchema>
export type CreateComponentInstallation = z.infer<
  typeof CreateComponentInstallationSchema
>
export type UpdateComponentInstallation = z.infer<
  typeof UpdateComponentInstallationSchema
>

export const FacilitySearchResultSchema = z.object({
  id: z.string(),
  rentalId: z.string(),
  code: z.string(),
  name: z.string().nullable(),
  property: z.object({
    code: z.string().nullable(),
    name: z.string().nullable(),
  }),
  building: z.object({
    code: z.string().nullable(),
    name: z.string().nullable(),
  }),
})

export type FacilitySearchResult = z.infer<typeof FacilitySearchResultSchema>

export const ResidenceSearchResultSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string().nullable(),
  deleted: z.boolean(),
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

export type ResidenceSearchResult = z.infer<typeof ResidenceSearchResultSchema>

export const ParkingSpaceSearchResultSchema = z.object({
  id: z.string(),
  rentalId: z.string(),
  code: z.string(),
  name: z.string().nullable(),
  property: z.object({
    code: z.string().nullable(),
    name: z.string().nullable(),
  }),
  building: z.object({
    code: z.string().nullable(),
    name: z.string().nullable(),
  }),
})

export type ParkingSpaceSearchResult = z.infer<
  typeof ParkingSpaceSearchResultSchema
>

export const ComponentSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  details: z.object({
    manufacturer: z.string().nullable(),
    typeDesignation: z.string().nullable(),
  }),
  dates: z.object({
    installation: z.string().nullable(),
    warrantyEnd: z.string().nullable(),
  }),
  classification: z.object({
    componentType: z.object({
      code: z.string(),
      name: z.string(),
    }),
    category: z.object({
      code: z.string(),
      name: z.string(),
    }),
  }),
  maintenanceUnits: z.array(
    z.object({
      id: z.string(),
      code: z.string(),
      name: z.string(),
    })
  ),
})

export type Component = z.infer<typeof ComponentSchema>
export type CompanyDetails = z.infer<typeof CompanyDetailsSchema>

// Document schema for file uploads/downloads
export const DocumentWithUrlSchema = z.object({
  id: z.string(),
  fileId: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  createdAt: z.string(),
  url: z.string(),
  uploadedAt: z.string().optional(),
  caption: z.string().optional(),
})

export type DocumentWithUrl = z.infer<typeof DocumentWithUrlSchema>
