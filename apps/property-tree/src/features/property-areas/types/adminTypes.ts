// Ändring av ansvarig kvartersvärd för ett KVV-område
export interface AreaReassignment {
  kvvArea: string
  fromSteward: {
    refNr: string
    name: string
  }
  toSteward: {
    refNr: string
    name: string
  }
  timestamp: Date
}

// Information om ett KVV-område
export interface KvvAreaInfo {
  kvvArea: string
  stewardRefNr: string
  stewardName: string
  stewardPhone?: string
  propertyCount: number
  residenceCount: number
  parkingCount: number
  entranceCount: number
}

export interface StewardInfo {
  refNr: string
  name: string
  phone?: string
  kvvArea?: string
  propertyCount: number
}

export interface PropertyForAdmin {
  id: string
  propertyCode: string
  propertyName: string
  address: string
  buildingType?: string
  kvvArea?: string
  stewardRefNr: string
  costCenter: string
  residenceCount?: number
  parkingCount?: number
  entranceCount?: number
}
