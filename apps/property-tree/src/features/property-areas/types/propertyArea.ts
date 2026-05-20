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

export const COST_CENTER_NAMES: Record<string, string> = {
  '61110': 'Mimer Mitt',
  '61120': 'Mimer Norr',
  '61130': 'Mimer Öst',
  '61140': 'Mimer Väst',
  '61150': 'Mimer Student',
}

export interface DistrictManagers {
  districtManager: string
  deputyDistrictManager: string
}

export const DISTRICT_MANAGERS: Record<string, DistrictManagers> = {
  '61110': {
    districtManager: 'Karin Lindqvist',
    deputyDistrictManager: 'Johan Bergman',
  },
  '61120': {
    districtManager: 'Anders Sjögren',
    deputyDistrictManager: 'Lina Ek',
  },
  '61130': {
    districtManager: 'Petra Holm',
    deputyDistrictManager: 'Mikael Sund',
  },
  '61140': {
    districtManager: 'Eva Forsberg',
    deputyDistrictManager: 'Tobias Lund',
  },
  '61150': {
    districtManager: 'Helena Norén',
    deputyDistrictManager: 'Daniel Åberg',
  },
}

export const BUILDING_TYPES: Record<string, string> = {
  STD: 'Standard',
  BLOCK: 'Block',
  '55PLUS': '55+',
  STUD: 'Student',
  TRYGG: 'Trygghetsboende',
  'CO-LIVING': 'Co-living',
  POANGFRITT: 'Poängfri',
  KOOPERATIV: 'Kooperativ',
}
