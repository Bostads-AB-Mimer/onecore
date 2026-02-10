import { Staircase } from '@/services/types'

// residence = apartment
export interface Residence {
  id: string
  code: string
  name: string
  deleted: boolean
  size?: number
  rooms?: number
  rent?: number
  status?: string
  apartmentType?: ApartmentType
  malarenergiFacilityId?: string
  validityPeriod: {
    fromDate: string
    toDate: string
  }
}

// New types for hierarchical entrance structure
export type ComponentType =
  | 'Digital bokningstavla'
  | 'Postboxar'
  | 'Brevlådor'
  | 'Cykelrum'
  | 'Barnvagnsförvaring'
  | 'Soprum'
  | 'El-mätare'
  | 'Värme-mätare'
  | 'Ventilation'

export type ApartmentType = 'Standard' | 'Övernattning' | 'Korttidsboende'

export interface EntranceComponent {
  id: string
  name: string
  type: ComponentType
  icon?: string
  status?: 'Aktiv' | 'Under underhåll' | 'Ur funktion'
  description?: string
}

export interface EntranceAddress {
  id: string
  name: string // Address name like "Odenplan 5A", "Odenplan 5B"
  apartments: string[] // Array of apartment IDs
  components: EntranceComponent[] // UI specific to this address
}

export interface Entrance {
  id: string
  name: string
  apartments: string[] // Array of apartment IDs (kept for backward compatibility)
  addresses?: EntranceAddress[] // New hierarchical structure
  components?: EntranceComponent[] // UI at entrance level
}

export interface Room {
  id: string
  code: string
  name: string | null
  size?: number // Added size property in square meters
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

export interface APIResponse<T> {
  content: T
}

export interface Property {
  id: string
  propertyObjectId: string
  code: string
  designation: string
  municipality: string
  purpose: string | null
  buildingType: string | null
  buildingCount?: number
  propertyManagerArea: string
  propertyValues: { name: string; value: number; unitId: string }[]
}

export interface Company {
  id: string
  propertyObjectId: string
  code: string
  name: string
  organizationNumber: string | null
}

export interface BuildingLocation {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
}

export interface PropertyMap {
  image: string
  buildings: BuildingLocation[]
}

export type SpaceType =
  | 'Trapphus'
  | 'Vind'
  | 'Terrasser'
  | 'Källare'
  | 'Lokaler'
  | 'Skyddsrum i byggnaden'
  | 'Förråd i byggnaden'
  | 'Tvättstugor i byggnaden'
  | 'Miljöbodar i byggnaden'
  | 'Teknikutrymmen'

export interface SpaceComponent {
  id: string
  name: string
  description?: string
  area?: number
  status?: 'Aktiv' | 'Under underhåll' | 'Ur funktion'
  specs?: {
    [key: string]: string
  }
}

export interface BuildingSpace {
  id: string
  type: SpaceType
  name: string
  totalArea?: number
  components: SpaceComponent[]
}

export interface PropertyValue {
  value: number
  name: string
  unitId: string
}

export interface PropertyDetail {
  id: string
  propertyObjectId: string
  marketAreaId: string
  districtId: string
  propertyDesignationId: string
  valueAreaId: string | null
  code: string
  designation: string
  municipality: string
  tract: string
  block: string
  sector: string | null
  propertyIndexNumber: string | null
  congregation: string
  builtStatus: number
  separateAssessmentUnit: number
  consolidationNumber: string | null
  ownershipType: string
  registrationDate: string | null
  acquisitionDate: string | null
  isLeasehold: number
  leaseholdTerminationDate: string | null
  area: number | null
  purpose: string | null
  buildingType: string | null
  propertyTaxNumber: string | null
  mainPartAssessedValue: number
  includeInAssessedValue: number
  grading: number
  deleteMark: number
  fromDate: string
  toDate: string
  timestamp: string
  marketArea: {
    id: string
    code: string
    name: string
  }
  district: {
    id: string
    code: string
    caption: string
  }
  buildings: Building[]
  propertyObject: {
    id: string
    deleteMark: number
    timestamp: string
    objectTypeId: string
    barcode: string | null
    barcodeType: number
    condition: number
    conditionInspectionDate: string | null
    vatAdjustmentPrinciple: number
    energyClass: number
    energyRegistered: string | null
    energyReceived: string | null
    energyIndex: number | null
    heatingNature: number
  }
  propertyValues?: PropertyValue[]
}

export interface BuildingType {
  id: string
  code: string
  name: string
}

export interface BuildingConstruction {
  constructionYear: number
  renovationYear: number | null
  valueYear: number | null
}

export interface BuildingFeatures {
  heating: string | null
  fireRating: string | null
}

export interface BuildingInsurance {
  class: string | null
  value: number | null
}

export interface Building {
  id: string
  code: string
  name: string
  buildingType: BuildingType
  construction: BuildingConstruction
  features: BuildingFeatures
  insurance: BuildingInsurance
  // These are just to make the lovable code happy
  staircases: Staircase[]
  apartments: Residence[]
  type: string | null
  area: number | null
  //
  deleted: boolean
}
