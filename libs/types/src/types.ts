import { z } from 'zod'
import {
  ApplicantStatus,
  LeaseStatus,
  ListingStatus,
  ParkingSpaceApplicationCategory,
  ParkingSpaceType,
  OfferStatus,
  WaitingListType,
} from './enums'
import {
  ApplicationProfileHousingReferenceSchema,
  ApplicationProfileSchema,
  CommentThreadIdSchema,
  CommentTypeSchema,
  CommentSchema,
  CommentThreadSchema,
  InvoiceRowSchema,
  InvoicePaymentEventSchema,
  InvoiceSchema,
} from './schemas/v1'

interface Contact {
  contactCode: string //cmctc.cmctckod
  contactKey: string //cmtct.keycmctc
  leaseIds?: string[]
  leases?: Lease[]
  firstName: string
  lastName: string
  fullName: string
  nationalRegistrationNumber: string
  birthDate: Date
  address: Address | undefined
  phoneNumbers: PhoneNumber[] | undefined
  emailAddress?: string
  isTenant: boolean
  parkingSpaceWaitingList?: WaitingList
  housingWaitingList?: WaitingList
  storageWaitingList?: WaitingList
  specialAttention?: boolean
}

type NonEmptyArray<T> = [T, ...T[]]

// The idea of a tenant is that it definitely has at least one active or upcoming(?) housing contract.
// In that way it's different than a Contact, which, by how the type looks, we
// don't know if it's actually a tenant.
export type Tenant = Omit<Contact, 'leases' | 'isTenant'> & {
  currentHousingContract?: Lease
  upcomingHousingContract?: Lease
  parkingSpaceContracts?: Lease[]
  housingContracts: NonEmptyArray<Lease>
  isAboutToLeave: boolean
}

interface PhoneNumber {
  phoneNumber: string
  type: string
  isMainNumber: boolean
}

interface Lease {
  leaseId: string
  leaseNumber: string
  leaseStartDate: Date
  leaseEndDate: Date | undefined
  status: LeaseStatus
  tenantContactIds: string[] | undefined
  tenants: Contact[] | undefined
  rentalPropertyId: string
  type: string
  noticeGivenBy: string | undefined
  noticeDate: Date | undefined
  noticeTimeTenant: string | undefined
  preferredMoveOutDate: Date | undefined
  terminationDate: Date | undefined
  contractDate: Date | undefined
  lastDebitDate: Date | undefined
  approvalDate: Date | undefined
  residentialArea?: ResidentialArea
}

interface ResidentialArea {
  code: string
  caption: string
}

interface RentalProperty {
  rentalPropertyId: string
  apartmentNumber: number
  size: number
  type: string
  address: Address | undefined
  rentalPropertyType: string
  additionsIncludedInRent: string
  otherInfo: string | undefined
  roomTypes: Array<RoomType> | undefined
  lastUpdated: Date | undefined
}

interface Address {
  street: string
  number: string
  postalCode: string
  city: string
}

interface RentInfo {
  currentRent: Rent
  futureRents: Array<Rent> | undefined
}

interface Rent {
  rentId?: string
  leaseId?: string
  currentRent: number
  vat: number
  additionalChargeDescription: string | undefined
  additionalChargeAmount: number | undefined
  rentStartDate: Date | undefined
  rentEndDate: Date | undefined
}

interface RoomType {
  roomTypeId: string
  name: string
  materialOptionGroups?: Array<MaterialOptionGroup>
}

interface MaterialChoice {
  materialChoiceId: string
  materialOptionId: string
  materialOptionGroupId: string
  apartmentId: string
  roomTypeId: string
  materialOption?: MaterialOption | undefined
  materialOptionGroup?: MaterialOptionGroup | undefined
  roomType?: RoomType | undefined
  status: string //TODO enum of Draft/Submitted/Cancelled
  dateOfSubmission?: Date
  dateOfCancellation?: Date
}

interface MaterialOptionGroup {
  materialOptionGroupId: string
  roomTypeId: string
  roomTypeName?: string
  name?: string
  actionName?: string
  materialOptions?: Array<MaterialOption>
  materialChoices?: Array<MaterialChoice>
  type: string //TODO enum of Concept/AddOn/SingleChoice
}

interface MaterialOption {
  materialOptionId: string
  caption: string
  shortDescription?: string
  description?: string
  coverImage?: string
  images?: Array<string>
  roomTypeName?: string
  materialOptionGroupName?: string
}

interface ConsumerReport {
  pnr: string
  template: string
  status: string
  status_text: string
  errorList: Array<ConsumerReportError> | []
  name: string
  address: string
  zip: string
  city: string
}

interface ConsumerReportError {
  Cause_of_Reject: string
  Reject_text: string
  Reject_comment: string
}

interface Email {
  to: string
  subject: string
  text: string
}

interface Sms {
  phoneNumber: string
}

interface Invoices {
  unpaidInvoices?: Invoice[]
  paidInvoices?: Invoice[]
}

interface WaitingList {
  queueTime: Date
  queuePoints: number
  type: WaitingListType
}

interface Listing {
  id: number
  rentalObjectCode: string
  publishedFrom: Date
  publishedTo?: Date
  status: ListingStatus
  rentalRule: 'SCORED' | 'NON_SCORED'
  listingCategory: 'PARKING_SPACE' | 'APARTMENT' | 'STORAGE'
  applicants?: Applicant[]
  rentalObject: RentalObject
}

interface Applicant {
  id: number
  name?: string | undefined
  nationalRegistrationNumber?: string | undefined
  contactCode: string
  applicationDate: Date
  applicationType?: string | undefined //todo: "Additional" or "Replace". Should be an enum in the future
  status: ApplicantStatus
  listingId: number
}

interface Offer {
  id: number
  sentAt: Date | null
  expiresAt: Date
  answeredAt: Date | null
  status: OfferStatus
  listingId: number
  offeredApplicant: Applicant
  createdAt: Date
}

interface OfferWithOfferApplicants extends Offer {
  selectedApplicants: Array<OfferApplicant>
}

interface OfferApplicant {
  id: number
  listingId: number
  offerId: number
  applicantId: number
  contactCode: string
  nationalRegistrationNumber: string
  status: ApplicantStatus
  applicationType: 'Replace' | 'Additional'
  queuePoints: number
  address: string
  hasParkingSpace: boolean
  housingLeaseStatus: LeaseStatus
  priority: number | null
  sortOrder: number
  createdAt: Date

  applicationDate: Date
  name: string
}

interface ApplicantWithListing {
  applicant: Applicant
  listing: Listing
}

interface RentalPropertyInfo {
  id: string
  type: string
  property: ApartmentInfo | CommercialSpaceInfo | ParkingSpaceInfo
  maintenanceUnits?: MaintenanceUnitInfo[]
}

interface ApartmentInfo {
  rentalTypeCode: string
  rentalType: string
  address: string
  code: string
  number: string
  type: string
  roomTypeCode: string
  entrance: string
  floor: string
  hasElevator: boolean
  washSpace: string
  area: number
  estateCode: string
  estate: string
  buildingCode: string
  building: string
}

interface CommercialSpaceInfo {
  rentalTypeCode: string
  rentalType: string
  address: string
  code: string
  type: string
  entrance: string
  estateCode: string
  estate: string
  buildingCode: string
  building: string
}

interface ParkingSpaceInfo {
  rentalTypeCode: string
  rentalType: string
  address: string
  code: string
}

interface ParkingSpace {
  parkingSpaceId: string
  address: Address
  rent: RentInfo
  vacantFrom: Date
  type: ParkingSpaceType
  applicationCategory: ParkingSpaceApplicationCategory
}

interface RentalObject {
  rentalObjectCode: string
  address: string
  monthlyRent: number //TODO: remove this one
  rent: Rent //use this one for rent instead
  districtCaption?: string
  districtCode?: string
  propertyCaption?: string
  propertyCode?: string
  residentialAreaCaption: string
  residentialAreaCode: string
  objectTypeCaption: string
  objectTypeCode: string
  vacantFrom?: Date
  braArea?: number
  btaArea?: number
  boaArea?: number
  isSpecialResidentialArea?: boolean
  isSpecialProperty?: boolean
}

interface RentalObjectRent {
  amount: number
  vat: number
  rows: Array<RentRow>
}

interface RentRow {
  code: string
  description: string
  amount: number
  vatPercentage: number
  fromDate: Date
  toDate: Date
}

interface MaintenanceUnitInfo {
  id: string
  rentalPropertyId: string
  code: string
  caption: string
  type: string
  estateCode: string
  estate: string
}

type ApplicationProfile = z.infer<typeof ApplicationProfileSchema>
type ApplicationProfileHousingReference = z.infer<
  typeof ApplicationProfileHousingReferenceSchema
>

type CommentThreadId = z.infer<typeof CommentThreadIdSchema>
type CommentType = z.infer<typeof CommentTypeSchema>
type Comment = z.infer<typeof CommentSchema>
type CommentThread = z.infer<typeof CommentThreadSchema>
type Invoice = z.infer<typeof InvoiceSchema>
type InvoiceRow = z.infer<typeof InvoiceRowSchema>
type InvoicePaymentEvent = z.infer<typeof InvoicePaymentEventSchema>

export type {
  Contact,
  Lease,
  RentalProperty,
  Address,
  Rent,
  RentInfo,
  RoomType,
  MaterialOption,
  MaterialOptionGroup,
  MaterialChoice,
  ConsumerReport,
  ConsumerReportError,
  Invoices,
  Invoice,
  InvoiceRow,
  InvoicePaymentEvent,
  RentalObject,
  RentalObjectRent,
  RentRow,
  ParkingSpace,
  Email,
  Sms,
  WaitingList,
  Listing,
  Applicant,
  ApplicantWithListing,
  Offer,
  OfferApplicant,
  OfferWithOfferApplicants,
  RentalPropertyInfo,
  ApartmentInfo,
  CommercialSpaceInfo,
  ParkingSpaceInfo,
  MaintenanceUnitInfo,
  ResidentialArea,
  ApplicationProfile,
  ApplicationProfileHousingReference,
  CommentThreadId,
  CommentThread,
  CommentType,
  Comment,
}
