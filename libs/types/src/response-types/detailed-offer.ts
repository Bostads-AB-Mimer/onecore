import { OfferStatus } from '../enums'
import { Applicant } from '../types'

//dependent services: onecore-leasing, onecore-core
interface DetailedOffer {
  id: number
  sentAt: Date | null
  expiresAt: Date
  answeredAt: Date | null
  status: OfferStatus
  listingId: number
  offeredApplicant: Applicant
  createdAt: Date
  rentalObjectCode: string
  vacantFrom: Date
}

export type {
  DetailedOffer
}