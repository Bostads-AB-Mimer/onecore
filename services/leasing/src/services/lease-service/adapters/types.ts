import {
  ApplicantStatus,
  LeaseStatus,
  ListingStatus,
  OfferStatus,
} from 'onecore-types'

export type DbOffer = {
  Id: number
  SentAt: Date | null
  ExpiresAt: Date
  AnsweredAt: Date | null
  Status: OfferStatus
  ListingId: number
  ApplicantId: number
  CreatedAt: Date
}

export type DbOfferApplicant = {
  id: number
  listingId: number
  offerId: number
  applicantId: number
  applicantStatus: ApplicantStatus
  applicantContactCode: string
  applicantNationalRegistrationNumber: string
  applicantApplicationType: 'Replace' | 'Additional'
  applicantQueuePoints: number
  applicantAddress: string
  applicantHasParkingSpace: boolean
  applicantHousingLeaseStatus: LeaseStatus
  applicantPriority: number
  sortOrder: number
  createdAt: Date
}

export type DbDetailedOffer = {
  Id: number
  SentAt: Date | null
  ExpiresAt: Date
  AnsweredAt: Date | null
  Status: OfferStatus
  ListingId: number
  ApplicantId: number
  CreatedAt: Date
  RentalObjectCode: string
  VacantFrom: Date
}

export type DbApplicant = {
  Id: number
  Name: string
  NationalRegistrationNumber: string
  ContactCode: string
  ApplicationDate: Date
  ApplicationType: string | null
  Status: ApplicantStatus
  ListingId: number
}

export type DbListing = {
  Id: number
  RentalObjectCode: string
  Address: string
  MonthlyRent: number
  DistrictCaption: string | null
  DistrictCode: string | null
  BlockCaption: string | null
  BlockCode: string | null
  ObjectTypeCaption: string | null
  ObjectTypeCode: string | null
  RentalObjectTypeCaption: string | null
  RentalObjectTypeCode: string | null
  PublishedFrom: Date
  PublishedTo: Date
  VacantFrom: Date
  Status: ListingStatus
  WaitingListType: string | null
}

export type AdapterResult<T, E> = { ok: true; data: T } | { ok: false; err: E }
