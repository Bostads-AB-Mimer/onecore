export interface Room {
  id: string
  code: string
  name: string | null
  usage: {
    shared: boolean
    allowPeriodicWorks: boolean
    spaceType: number
  }
  features: {
    hasToilet: boolean
    isHeated: boolean
    hasThermostatValve: boolean
    orientation: number
  }
  dates: {
    installation: string | null
    from: string
    to: string
    availableFrom: string | null
    availableTo: string | null
  }
  sortingOrder: number
  deleted: boolean
  timestamp: string
  roomType: {
    roomTypeId: string
    roomTypeCode: string
    name: string | null
    use: number
    optionAllowed: number
    isSystemStandard: number
    allowSmallRoomsInValuation: number
    timestamp: string
  } | null
}

export interface Component {
  id: string
  code: string
  name: string
  details: {
    manufacturer: string | null
    typeDesignation: string | null
  }
  dates: {
    installation: string | null
    warrantyEnd: string | null
  }
  classification: {
    componentType: {
      code: string
      name: string
    }
    category: {
      code: string
      name: string
    }
  }
  maintenanceUnits: Array<{
    id: string
    code: string
    name: string
  }>
}

export interface Residence {
  id: string
  code: string
  name: string
  links: {
    building: string
    property: string
  }
  location: string
  accessibility: {
    wheelchairAccessible: boolean
    residenceAdapted: boolean
    elevator: boolean
  }
  features: {
    balcony1?: {
      location: string
      type: string
    }
    balcony2?: {
      location: string
      type: string
    }
    patioLocation?: string
    hygieneFacility: string
    sauna: boolean
    extraToilet: boolean
    sharedKitchen: boolean
    petAllergyFree: boolean
    electricAllergyIntolerance: boolean
    smokeFree: boolean
    asbestos: boolean
  }
  rooms: Room[]
  entrance: string
  partNo: number | null
  part: string | null
  deleted: boolean
  validityPeriod: {
    fromDate: string
    toDate: string
  }
  residenceType: {
    residenceTypeId: string
    code: string
    name: string | null
    roomCount: number | null
    kitchen: number
    systemStandard: number
    checklistId: string | null
    componentTypeActionId: string | null
    statisticsGroupSCBId: string | null
    statisticsGroup2Id: string | null
    statisticsGroup3Id: string | null
    statisticsGroup4Id: string | null
    timestamp: string
  }
  propertyObject: {
    energy: {
      energyClass: number
      energyRegistered?: string
      energyReceived?: string
      energyIndex?: number
    }
  }
}

export interface Building {
  id: string
  code: string
  name: string
  construction: {
    constructionYear: number | null
    renovationYear: number | null
    valueYear: number | null
  }
  features: {
    heating: string | null
    fireRating: string | null
  }
  insurance: {
    class: string | null
    value: number | null
  }
  deleted: boolean
}

export interface Property {
  propertyId: string
  propertyCode: string
  tract: string
  propertyDesignation: {
    propertyDesignationId: string
    code: string
    name: string | null
    timestamp: string
  }
  _links: {
    self: {
      href: string
    }
  }
}

export interface Staircase {
  id: string
  code: string
  name: string | null
  features: {
    floorPlan: string | null
    accessibleByElevator: boolean
  }
  dates: {
    from: string
    to: string
  }
  deleted: boolean
  timestamp: string
}

export interface NavigationItem {
  id: string
  name: string
  type: 'area' | 'property' | 'building' | 'staircase' | 'residence'
  children?: NavigationItem[]
  metadata?: {
    residenceId?: string
  }
}
