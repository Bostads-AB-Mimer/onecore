import { ApplicantStatus, LeaseStatus, OfferStatus } from '../enums'

interface CreateOfferApplicantParams {
  listingId: number
  applicantId: number
  status: ApplicantStatus
  applicationType: 'Replace' | 'Additional'
  queuePoints: number
  address: string
  hasParkingSpace: boolean
  housingLeaseStatus: LeaseStatus
  priority: number | null
}

interface CreateOfferParams {
  status: OfferStatus
  expiresAt: Date
  sentAt: Date
  listingId: number
  applicantId: number
  selectedApplicants: Array<CreateOfferApplicantParams>
}

export type { CreateOfferParams, CreateOfferApplicantParams }
