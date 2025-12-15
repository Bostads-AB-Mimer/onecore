import type { components } from './api/core/generated/api-types'
import type {
  ResidentialArea,
  ApplicantStatus,
  WaitingListType,
  ApplicationProfileHousingReference,
  Address,
} from '@onecore/types'

export interface WaitingListResponse {
  queueTime: string
  queuePoints: number
  type: WaitingListType
}

export interface ApplicantResponse {
  id: number
  contactCode: string
  applicationDate: string
  applicationType?: string
  status: ApplicantStatus
  listingId: number
}

export interface ApplicationProfileResponse {
  numAdults: number
  numChildren: number
  housingType: string
  housingTypeDescription?: string
  landlord?: string
  housingReference?: {
    phone?: string
    email?: string
    reviewStatus?: string
    comment?: string
    reasonRejected?: string
    reviewedAt?: string
    reviewedBy?: string
    expiresAt?: string
  }
}

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
export type MaintenanceUnit = components['schemas']['MaintenanceUnit']
export type FileMetadataWithUrl = components['schemas']['FileMetadataWithUrl']
export type ComponentImage = FileMetadataWithUrl
export type ComponentModelDocument = FileMetadataWithUrl
export type ComponentInstance = components['schemas']['ComponentInstance']

// Component Library entity types
export type ComponentCategory = components['schemas']['ComponentCategory']
export type ComponentType = components['schemas']['ComponentType']
export type ComponentSubtype = components['schemas']['ComponentSubtype']
export type ComponentModel = components['schemas']['ComponentModel']

// Component Library request types
export type CreateComponentCategory =
  components['schemas']['CreateComponentCategoryRequest']
export type UpdateComponentCategory =
  components['schemas']['UpdateComponentCategoryRequest']
export type CreateComponentType =
  components['schemas']['CreateComponentTypeRequest']
export type UpdateComponentType =
  components['schemas']['UpdateComponentTypeRequest']
export type CreateComponentSubtype =
  components['schemas']['CreateComponentSubtypeRequest']
export type UpdateComponentSubtype =
  components['schemas']['UpdateComponentSubtypeRequest']
export type CreateComponentModel =
  components['schemas']['CreateComponentModelRequest']
export type UpdateComponentModel =
  components['schemas']['UpdateComponentModelRequest']

// Component Instance request types
export type CreateComponentInstance = {
  modelId: string
  serialNumber: string
  specifications?: string | null
  additionalInformation?: string | null
  warrantyStartDate?: string | null
  warrantyMonths: number
  priceAtPurchase: number
  depreciationPriceAtPurchase: number
  ncsCode?: string | null
  status?: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'DECOMMISSIONED'
  quantity: number
  economicLifespan: number
}

export type UpdateComponentInstance = Partial<CreateComponentInstance>

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
  address: Address
  phoneNumbers: Array<{
    phoneNumber: string
    type: string
    isMainNumber: number
  }>
  emailAddress: string
  isTenant: boolean
  parkingSpaceWaitingList: WaitingListResponse
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
 * Interest application type that extends the API response Applicant type
 * with additional UI-specific display fields.
 *
 * Note: This is a view model that combines Applicant data with Listing details
 * for convenient display in the UI. All dates are ISO strings from the API.
 */
export interface InterestApplication extends ApplicantResponse {
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
 * All dates are ISO strings from the API (not Date objects).
 */
export interface QueueData {
  parking?: WaitingListResponse
  housing?: WaitingListResponse
  storage?: WaitingListResponse
  interestApplications: InterestApplication[]
  housingReferences?: {
    currentHousingForm?: string
    landlord?: string
    householdSize?: number
    numAdults?: number
    numChildren?: number
    referenceStatus?: string
  }
  applicationProfile?: ApplicationProfileResponse
}

// Tenant Comments/Notes Types
/**
 * Individual note within a comment from the API
 */
export interface TenantCommentNote {
  date: string // "2025-11-27"
  time: string // "14:49"
  author: string // "DAVLIN"
  text: string // The actual comment text
}

/**
 * Raw API response from /contacts/<contact>/comments
 */
export interface TenantCommentRaw {
  contactKey: string
  contactCode: string
  commentKey: string
  id: number
  commentType: string
  notes: TenantCommentNote[]
  priority: number
  kind: number
}

/**
 * Transformed comment for UI display (flattened from notes array)
 * Each note is transformed into its own TenantComment
 */
export interface TenantComment {
  id: string
  commentKey: string
  text: string
  author: string
  createdAt: string // ISO datetime combining date + time
}

/**
 * API response wrapper for comments endpoint
 */
export interface TenantCommentsResponse {
  content: TenantCommentRaw[]
  _links?: Record<string, { href: string }>
}
