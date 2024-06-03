import { Factory } from 'fishery'
import { Offer, OfferStatus } from 'onecore-types'

import { ApplicantFactory } from './applicant'

export const OfferFactory = Factory.define<Offer>(({ sequence }) => ({
  answeredAt: null,
  expiresAt: new Date(),
  id: sequence,
  listingId: 1,
  offeredApplicant: ApplicantFactory.build(),
  selectedApplicants: [],
  sentAt: null,
  status: OfferStatus.Active,
  createdAt: new Date(),
}))
