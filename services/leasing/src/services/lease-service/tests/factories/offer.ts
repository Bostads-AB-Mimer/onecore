import { Factory } from 'fishery'
import { Offer, OfferStatus, OfferWithRentalObjectCode } from 'onecore-types'

import { DetailedApplicantFactory } from './detailed-applicant'

export const OfferFactory = Factory.define<Offer>(({ sequence }) => ({
  answeredAt: null,
  expiresAt: new Date(),
  id: sequence,
  listingId: 1,
  offeredApplicant: DetailedApplicantFactory.build(),
  selectedApplicants: [],
  sentAt: null,
  status: OfferStatus.Active,
  createdAt: new Date(),
}))

export const OfferWithRentalObjectCodeFactory =
  Factory.define<OfferWithRentalObjectCode>(({ sequence }) => ({
    answeredAt: null,
    expiresAt: new Date(),
    id: sequence,
    listingId: 1,
    offeredApplicant: DetailedApplicantFactory.build(),
    selectedApplicants: [],
    sentAt: null,
    status: OfferStatus.Active,
    createdAt: new Date(),
    rentalObjectCode: `${sequence}`,
  }))
