import type { components } from './api/generated/api-types'
import type {
  WaitingList,
  Address as SharedAddress,
  Lease as SharedLease,
  ResidentialArea,
  Applicant as SharedApplicant,
  ApplicantStatus,
  WaitingListType,
  ApplicationProfile as SharedApplicationProfile,
  ApplicationProfileHousingReference,
} from '@onecore/types'

// Utility type to convert Date fields to string (for JSON serialization)
type Serialized<T> = T extends Date
  ? string
  : T extends object
    ? { [K in keyof T]: Serialized<T[K]> }
    : T

// Serialized versions for API responses
export type SerializedWaitingList = Serialized<WaitingList>
export type SerializedAddress = Serialized<SharedAddress>
export type SerializedLease = Serialized<SharedLease>
export type SerializedApplicant = Serialized<SharedApplicant>

// Re-export shared types for convenience
export type {
  ApplicantStatus,
  WaitingListType,
  ApplicationProfileHousingReference,
}

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
  residentialArea: ResidentialArea
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
  address: SerializedAddress
  phoneNumbers: Array<{
    phoneNumber: string
    type: string
    isMainNumber: number
  }>
  emailAddress: string
  isTenant: boolean
  parkingSpaceWaitingList: SerializedWaitingList
  specialAttention: boolean
  isAboutToLeave: boolean
  currentHousingContract: ContractType
  parkingSpaceContracts: ContractType[]
  housingContracts: ContractType[]
}

// Queue System Types
export interface ParkingSpaceForPublishing {
  id: string
  listingId?: number // Database ID for /listings/apply endpoint
  rentalId: string
  address: string
  area: string
  type: string
  rentIncl: number
  district: string
  queueTypes: {
    intern: boolean
    external: boolean
    poangfri: boolean
  }
  publications?: {
    publishedFrom: string
    publishedTo: string
    vacantFrom: string
  }
}

/**
 * Interest application type that extends the shared Applicant type
 * with additional UI-specific display fields.
 *
 * Note: This is a view model that combines Applicant data with Listing details
 * for convenient display in the UI.
 */
export interface InterestApplication extends SerializedApplicant {
  parkingSpace?: ParkingSpaceForPublishing
  queuePoints?: number
  address?: string
  rentalObjectCode?: string
  publishedFrom?: string
  publishedTo?: string
  vacantFrom?: string
}

export interface ValidationData {
  hasContractInDistrict?: boolean
  hasUpcomingContractInDistrict?: boolean
  validationResult?: string
  applicationType?: 'Replace' | 'Additional'
  isEligible?: boolean
  message?: string
}

/**
 * Queue data aggregation type for tenant information.
 * Combines data from multiple API endpoints:
 * - /contacts/{contactCode} - queue points and waiting lists
 * - /applicants-with-listings - interest applications
 * - /contacts/{contactCode}/application-profile - housing references
 *
 * Note: This is a UI-specific aggregation type, not a domain type.
 * It uses serialized versions of shared types (Date -> string for JSON).
 */
export interface QueueData {
  parking?: SerializedWaitingList
  housing?: Omit<SerializedWaitingList, 'type'> // Housing doesn't have type in API
  storage?: Omit<SerializedWaitingList, 'type'> // Storage doesn't have type in API
  interestApplications: InterestApplication[]
  housingReferences?: {
    currentHousingForm?: string
    landlord?: string
    householdSize?: number
    numAdults?: number
    numChildren?: number
    referenceStatus?: string
  }
  applicationProfile?: Serialized<SharedApplicationProfile>
}
