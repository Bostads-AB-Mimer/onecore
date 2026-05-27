// Ändring av ansvarig kvartersvärd för ett KVV-område
export interface AreaReassignment {
  kvvArea: string
  fromSteward: {
    id: string
    name: string
  }
  toSteward: {
    id: string
    name: string
  }
  timestamp: Date
}

// Information om ett KVV-område
export interface KvvAreaInfo {
  kvvAreaId: string
  kvvArea: string
  stewardId: string
  stewardName: string
  stewardEmployeeId?: string
  stewardPhone?: string
  propertyCount: number
  residenceCount: number
  parkingCount: number
  entranceCount: number
}

export interface StewardInfo {
  id: string
  name: string
  employeeId?: string
  phone?: string
  kvvArea?: string
  propertyCount: number
}

export interface PropertyForAdmin {
  id: string
  propertyCode: string
  propertyName: string
  addresses: string[]
  buildingType?: { code: string | null; name: string | null } | null
  kvvAreaId: string
  kvvArea?: string
  stewardId: string
  costCenter: string
  residenceCount?: number
  parkingCount?: number
  entranceCount?: number
}

// A pending drag-and-drop move of a property between KVV areas, kept locally
// until the user clicks Save. Mirrors AreaReassignment but for properties.
export interface PropertyMoveChange {
  propertyCode: string
  propertyName: string
  fromKvvAreaId: string
  fromKvvArea: string
  toKvvAreaId: string
  toKvvArea: string
}
