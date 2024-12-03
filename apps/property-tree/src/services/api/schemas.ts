import { z } from 'zod'

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
  roomType: z
    .object({
      roomTypeId: z.string(),
      roomTypeCode: z.string(),
      name: z.string().nullable(),
      use: z.number(),
      optionAllowed: z.number(),
      isSystemStandard: z.number(),
      allowSmallRoomsInValuation: z.number(),
      timestamp: z.string(),
    })
    .nullable(),
})

export const ComponentSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  details: z.object({
    manufacturer: z.string().nullable(),
    typeDesignation: z.string().nullable(),
  }),
  dates: z.object({
    installation: z.string().datetime().nullable(),
    warrantyEnd: z.string().datetime().nullable(),
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

export const ResidenceSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  links: z.object({
    building: z.string(),
    property: z.string(),
  }),
  location: z.string(),
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
    patioLocation: z.string().optional(),
    hygieneFacility: z.string(),
    sauna: z.boolean(),
    extraToilet: z.boolean(),
    sharedKitchen: z.boolean(),
    petAllergyFree: z.boolean(),
    electricAllergyIntolerance: z.boolean(),
    smokeFree: z.boolean(),
    asbestos: z.boolean(),
  }),
  rooms: z.array(RoomSchema),
  entrance: z.string(),
  partNo: z.number().nullable(),
  part: z.string().nullable(),
  deleted: z.boolean(),
  validityPeriod: z.object({
    fromDate: z.string().datetime(),
    toDate: z.string().datetime(),
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
      energyRegistered: z.string().datetime().optional(),
      energyReceived: z.string().datetime().optional(),
      energyIndex: z.number().optional(),
    }),
  }),
})

export const BuildingSchema = z.object({
  id: z.string(),
  objectId: z.string(),
  buildingTypeId: z.string(),
  marketAreaId: z.string(),
  districtId: z.string(),
  propertyDesignationId: z.string(),
  blockId: z.string().nullable(),
  heatingId: z.string(),
  buildingCode: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  constructionYear: z.number().nullable(),
  renovationYear: z.number().nullable(),
  valueYear: z.number().nullable(),
  heating: z.string(),
  fireRating: z.string().nullable(),
  insuranceClass: z.string().nullable(),
  insuranceValue: z.number().nullable(),
  lmhNumber: z.string().nullable(),
  assessmentYear: z.number().nullable(),
  grade: z.number(),
  socialPlan: z.number(),
  socialPlanFrom: z.string().nullable(),
  socialPlanTo: z.string().nullable(),
  percentCommonArea: z.number().nullable(),
  deleteMark: z.number(),
  fromDate: z.string(),
  toDate: z.string(),
  lastContractStartDate: z.string().nullable(),
  lastContractEndDate: z.string().nullable(),
  timestamp: z.string(),
  buildingType: z.object({
    id: z.string(),
    componentTypeActionId: z.string().nullable(),
    buildingTypeCode: z.string(),
    buildingTypeName: z.string(),
    isSystemStandard: z.number(),
    timestamp: z.string()
  }),
  marketArea: z.object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
    timestamp: z.string()
  }),
  district: z.object({
    id: z.string(),
    code: z.string(),
    caption: z.string(),
    timestamp: z.string()
  }),
  propertyDesignation: z.object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
    timestamp: z.string()
  })
})

export const PropertySchema = z.object({
  id: z.string(),
  code: z.string(),
  tract: z.string(),
  propertyDesignation: z.object({
    id: z.string(),
    code: z.string(),
    name: z.string().nullable(),
    timestamp: z.string()
  }),
  _links: z.object({
    self: z.object({
      href: z.string()
    })
  })
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
  deleted: z.boolean(),
  timestamp: z.string(),
})

// Types
export type Property = z.infer<typeof PropertySchema>
export type Building = z.infer<typeof BuildingSchema>
export type Residence = z.infer<typeof ResidenceSchema>
export type Component = z.infer<typeof ComponentSchema>
export type Room = z.infer<typeof RoomSchema>
export type Staircase = z.infer<typeof StaircaseSchema>
