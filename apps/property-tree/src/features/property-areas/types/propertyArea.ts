export interface PropertyAreaEntry {
  id: string
  costCenter: string // k-ställe (61110, 61120, etc)
  kvvArea?: string // Kvartersvärdsområde (61111, 61112, etc)
  stewardName: string // Kvartersvärd
  stewardRefNr: string // Ref.nr (YY2489, etc)
  stewardPhone?: string // Telefonnummer
  propertyCode: string // Fastighetsnummer (04101, etc)
  propertyName: string // Fastighet (JOSEF 7, etc)
  address: string // Adress
  buildingType?: string // Typ (STD, BLOCK, 55PLUS, STUD, TRYGG, CO-LIVING)
  residenceCount?: number // Antal Bostad
  commercialCount?: number // Antal Lokal
  garageCount?: number // Antal Garage
  parkingCount?: number // Antal p-plats
  otherCount?: number // Antal Övrigt
  residenceArea?: number // YTA Bostad (kvm)
  commercialArea?: number // YTA Lokal (kvm)
  garageArea?: number // YTA Garage (kvm)
  entranceCount?: number // Antal trappuppgångar
}

export interface Steward {
  id: string
  name: string
  refNr: string
  phone?: string
  costCenter: string
  propertyCount: number
}

export interface CostCenter {
  code: string
  name: string
  stewardCount: number
  propertyCount: number
}
export interface DistrictManagers {
  districtManager: string
  deputyDistrictManager: string
}
