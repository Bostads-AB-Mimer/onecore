import type {
  Room,
  Component,
  Residence,
  Building,
  Property,
  Staircase
} from './api/schemas'

export type {
  Room,
  Component,
  Residence,
  Building,
  Property,
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
