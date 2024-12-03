import { z } from 'zod'

export const RoomSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string().nullable(),
  usage: z.object({
    shared: z.boolean(),
    allowPeriodicWorks: z.boolean(),
    spaceType: z.number()
  }),
  features: z.object({
    hasToilet: z.boolean(),
    isHeated: z.boolean(),
    hasThermostatValve: z.boolean(),
    orientation: z.number()
  }),
  dates: z.object({
    installation: z.string().datetime().nullable(),
    from: z.string().datetime(),
    to: z.string().datetime(),
    availableFrom: z.string().datetime().nullable(),
    availableTo: z.string().datetime().nullable()
  }),
  sortingOrder: z.number(),
  deleted: z.boolean(),
  timestamp: z.string(),
  roomType: z.object({
    roomTypeId: z.string(),
    roomTypeCode: z.string(),
    name: z.string().nullable(),
    use: z.number(),
    optionAllowed: z.number(),
    isSystemStandard: z.number(),
    allowSmallRoomsInValuation: z.number(),
    timestamp: z.string()
  }).nullable()
})

export const ComponentSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  details: z.object({
    manufacturer: z.string().nullable(),
    typeDesignation: z.string().nullable()
  }),
  dates: z.object({
    installation: z.string().datetime().nullable(),
    warrantyEnd: z.string().datetime().nullable()
  }),
  classification: z.object({
    componentType: z.object({
      code: z.string(),
      name: z.string()
    }),
    category: z.object({
      code: z.string(),
      name: z.string()
    })
  }),
  maintenanceUnits: z.array(z.object({
    id: z.string(),
    code: z.string(),
    name: z.string()
  }))
})

export const ResidenceSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  links: z.object({
    building: z.string(),
    property: z.string()
  }),
  location: z.string(),
  accessibility: z.object({
    wheelchairAccessible: z.boolean(),
    residenceAdapted: z.boolean(),
    elevator: z.boolean()
  }),
  features: z.object({
    balcony1: z.object({
      location: z.string(),
      type: z.string()
    }).optional(),
    balcony2: z.object({
      location: z.string(),
      type: z.string()
    }).optional(),
    patioLocation: z.string().optional(),
    hygieneFacility: z.string(),
    sauna: z.boolean(),
    extraToilet: z.boolean(),
    sharedKitchen: z.boolean(),
    petAllergyFree: z.boolean(),
    electricAllergyIntolerance: z.boolean(),
    smokeFree: z.boolean(),
    asbestos: z.boolean()
  }),
  rooms: z.array(RoomSchema),
  entrance: z.string(),
  partNo: z.number().nullable(),
  part: z.string().nullable(),
  deleted: z.boolean(),
  validityPeriod: z.object({
    fromDate: z.string().datetime(),
    toDate: z.string().datetime()
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
    timestamp: z.string()
  }),
  propertyObject: z.object({
    energy: z.object({
      energyClass: z.number(),
      energyRegistered: z.string().datetime().optional(),
      energyReceived: z.string().datetime().optional(),
      energyIndex: z.number().optional()
    })
  })
})

export const BuildingSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  construction: z.object({
    constructionYear: z.number().nullable(),
    renovationYear: z.number().nullable(),
    valueYear: z.number().nullable()
  }),
  features: z.object({
    heating: z.string().nullable(),
    fireRating: z.string().nullable()
  }),
  insurance: z.object({
    class: z.string().nullable(),
    value: z.number().nullable()
  }),
  deleted: z.boolean()
})

export const PropertySchema = z.object({
  propertyId: z.string(),
  propertyCode: z.string(),
  tract: z.string(),
  propertyDesignation: z.object({
    propertyDesignationId: z.string(),
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
    accessibleByElevator: z.boolean()
  }),
  dates: z.object({
    from: z.string().datetime(),
    to: z.string().datetime()
  }),
  deleted: z.boolean(),
  timestamp: z.string()
})

// Types
export type Property = z.infer<typeof PropertySchema>
export type Building = z.infer<typeof BuildingSchema>
export type Residence = z.infer<typeof ResidenceSchema>
export type Component = z.infer<typeof ComponentSchema>
export type Room = z.infer<typeof RoomSchema>
export type Staircase = z.infer<typeof StaircaseSchema>
