import type {
  Room,
  Component,
  Residence,
  Building as BaseBuilding,
  Property,
  Staircase
} from './api/schemas'

export type {
  Room,
  Component,
  Residence,
  Staircase
}

// Common links interface
export interface Links {
  _links: {
    self: { href: string }
    [key: string]: { href: string }
  }
}

export interface Company {
  id: string
  propertyObjectId: string
  code: string
  name: string
  organizationNumber: string | null
}

export interface Property {
  id: string
  code: string
  tract: string
  propertyDesignation: {
    propertyDesignationId: string
    code: string
    name: string
    timestamp: string
  }
  propertyObject: {
    deleted: boolean
    timestamp: string
    objectType: {
      id: string
      code: string
      name: string
    } | null
    condition: string | null
    conditionInspectionDate: string | null
    energy: {
      class: number | null
      registered: string | null
      received: string | null
      index: number | null
    }
  } | null
  statistics?: {
    totalBuildings: number
    totalResidences: number
    occupiedResidences: number
    totalArea: number
    averageRent: number
  }
}

export interface PropertyWithLinks extends Property {
  _links: {
    self: { href: string }
    buildings: { href: string }
    residences: { href: string }
    statistics: { href: string }
  }
}

export interface Building extends BaseBuilding {
  features: {
    heating: string | null
    fireRating: string | null
    hasElevator: boolean
    accessControl: string
    energyClass: string
  }
  insurance: {
    class: string | null
    value: number | null
    lastInspection: string | null
    nextInspection: string | null
  }
  maintenance: {
    lastMaintenance: string | null
    nextMaintenance: string | null
    condition: 'good' | 'fair' | 'poor'
    notes: string | null
  }
  statistics: {
    totalResidences: number
    occupiedResidences: number
    totalArea: number
    averageRent: number
  }
}

export interface BuildingWithLinks extends Building {
  _links: {
    self: { href: string }
    property: { href: string }
    residences: { href: string }
    staircases: { href: string }
  }
}

export interface CompanyDetails extends Company {
  phone: string | null
  fax: string | null
  vatNumber: string | null
  internalExternal: number
  fTax: number
  cooperativeHousingAssociation: number
  differentiatedAdditionalCapital: number
  rentAdministered: number
  blocked: number
  rentDaysPerMonth: number
  economicPlanApproved: number
  vatObligationPercent: number
  vatRegistered: number
  energyOptimization: number
  ownedCompany: number
  interestInvoice: number
  errorReportAdministration: number
  mediaBilling: number
  ownResponsibilityForInternalMaintenance: number
  subletPercentage: any
  subletFeeAmount: number
  disableQuantitiesBelowCompany: number
  timestamp: string
}

export interface NavigationItem {
  id: string
  name: string
  type: 'company' | 'property' | 'building' | 'staircase' | 'residence'
  children?: NavigationItem[]
  metadata?: {
    residenceId?: string
  }
  _links?: {
    [key: string]: {
      href: string
    }
  }
}

// Extend base types with links
export type RoomWithLinks = Room & Links
export type ComponentWithLinks = Component & Links
export type ResidenceWithLinks = Residence & Links
export type BuildingWithLinks = Building & Links
export type PropertyWithLinks = Property & Links
export type StaircaseWithLinks = Staircase & Links
export type CompanyWithLinks = Company & Links
