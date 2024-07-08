import { ApplicantStatus, OfferStatus } from 'onecore-types'

export type DbOffer = {
  Id: number
  SentAt: Date | null
  ExpiresAt: Date
  AnsweredAt: Date | null
  SelectionSnapshot: string
  Status: OfferStatus
  ListingId: number
  ApplicantId: number
  CreatedAt: Date
}

export type DbApplicant = {
  Id: number
  Name: string
  NationalRegistrationNumber: string
  ContactCode: string
  ApplicationDate: Date
  ApplicationType?: string | undefined
  Status: ApplicantStatus
  ListingId: number
}

export type AdapterResult<T, E> = { ok: true; data: T } | { ok: false; err: E }
