import type { components } from './api/generated/api-types'

// Extract types from the generated schemas
export type Company = components['schemas']['Company']
export type CompanyDetails = components['schemas']['CompanyDetails']
export type Property = components['schemas']['Property']
export type Building = components['schemas']['Building']
export type Staircase = components['schemas']['Staircase']
export type Residence = components['schemas']['Residence']
export type ResidenceSearchResult =
  components['schemas']['ResidenceSearchResult']
export type ResidenceSummary = components['schemas']['ResidenceSummary']
export type Room = components['schemas']['Room']
export type Component = components['schemas']['Component']

// Custom types that aren't in the API
export interface Issue {
  id: string
  description: string
  priority: 'low' | 'medium' | 'high'
  status: 'pending' | 'in-progress' | 'resolved'
  room: string
  feature: string
  date: string
  residenceId: string
}

export interface NavigationItem {
  id: string
  name: string
  type: 'company' | 'property' | 'building' | 'staircase' | 'residence'
  children?: NavigationItem[]
  metadata?: {
    residenceId?: string
    propertyId?: string
    buildingId?: string
    staircaseId?: string
  }
  _links?: {
    [key: string]: {
      href: string
    }
  }
}

export interface DashboardCard {
  id: string
  title: string
  icon: any // LucideIcon type from lucide-react
  description: string
  path: string
  isExternal: boolean
  isDisabled: boolean
}

// Tenant-related types
export interface ContractType {
  leaseId: string
  leaseNumber: string
  rentalPropertyId: string
  type: string
  leaseStartDate: string
  leaseEndDate: string | null
  status: number
  tenantContactIds: string[]
  tenants: string[]
  noticeGivenBy: string | null
  noticeDate: string | null
  noticeTimeTenant: number
  preferredMoveOutDate: string | null
  terminationDate: string | null
  contractDate: string
  lastDebitDate: string | null
  approvalDate: string | null
  residentialArea: {
    code: string
    caption: string
  }
  propertyType?: string
}

export interface Tenant {
  contactCode: string
  contactKey: string
  firstName: string
  lastName: string
  fullName: string
  leaseIds: string[]
  nationalRegistrationNumber: string
  birthDate: string
  address: {
    street: string
    number: string
    postalCode: string
    city: string
  }
  phoneNumbers: Array<{
    phoneNumber: string
    type: string
    isMainNumber: number
  }>
  emailAddress: string
  isTenant: boolean
  parkingSpaceWaitingList: {
    queueTime: string
    queuePoints: number
    type: number
  }
  specialAttention: boolean
  isAboutToLeave: boolean
  currentHousingContract: ContractType
  parkingSpaceContracts: ContractType[]
  housingContracts: ContractType[]
}
