import {
  ApplicantStatus,
  LeaseStatus,
  ListingStatus,
  OfferStatus,
} from '@onecore/types'

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
  PublishedFrom: Date
  PublishedTo: Date
  Status: ListingStatus
  RentalRule: 'SCORED' | 'NON_SCORED'
  ListingCategory: 'PARKING_SPACE' | 'APARTMENT' | 'STORAGE'
}

export type DbComment = {
  Id: number
  TargetType: string
  TargetId: number
  AuthorName: string
  AuthorId: string
  CreatedAt: Date
  Type: 'COMMENT' | 'WARNING' | 'STOP'
  Comment: string
}

export type DbListingTextContent = {
  Id: number
  RentalObjectCode: string
  ContentBlocks: string
  CreatedAt: Date
  UpdatedAt: Date
}

export type AdapterResult<T, E> = { ok: true; data: T } | { ok: false; err: E }
