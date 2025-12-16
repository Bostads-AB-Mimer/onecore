import { z } from 'zod'

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

export const RentalBlockSchema = z.object({
  id: z.string(),
  blockReasonId: z.string(),
  blockReason: z.string(),
  fromDate: z.coerce.date(),
  toDate: z.coerce.date().nullable(),
  amount: z.number().nullable(),
})

export const GetRentalBlocksByRentalIdQueryParamsSchema = z.object({
  includeActiveBlocksOnly: z
    .string()
    .optional()
    .transform((val) => val === 'true')
    .default('false'),
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
export type RentalBlock = z.infer<typeof RentalBlockSchema>
