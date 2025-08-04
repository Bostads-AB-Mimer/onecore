import { Factory } from 'fishery'
import {
  DetailedOffer,
  Offer,
  OfferStatus,
  OfferWithRentalObjectCode,
} from 'onecore-types'
import { DetailedApplicantFactory } from './detailed-applicant'

export const OfferFactory = Factory.define<Offer>(({ sequence }) => {
  const applicant = DetailedApplicantFactory.build()
  return {
    answeredAt: null,
    expiresAt: new Date(),
    id: sequence,
    listingId: 1,
    offeredApplicant: applicant,
    sentAt: null,
    status: OfferStatus.Active,
    createdAt: new Date(),
  }
})

export const OfferWithRentalObjectCodeFactory =
  Factory.define<OfferWithRentalObjectCode>(({ sequence }) => {
    const applicant = DetailedApplicantFactory.build()
    return {
      answeredAt: null,
      expiresAt: new Date(),
      id: sequence,
      listingId: 1,
      offeredApplicant: applicant,
      sentAt: null,
      status: OfferStatus.Active,
      createdAt: new Date(),
      rentalObjectCode: `${sequence}`,
    }
  })

export const DetailedOfferFactory = Factory.define<DetailedOffer>(
  ({ sequence }) => ({
    answeredAt: null,
    expiresAt: new Date(),
    id: sequence,
    listingId: 1,
    offeredApplicant: DetailedApplicantFactory.build(),
    sentAt: null,
    status: OfferStatus.Active,
    createdAt: new Date(),
    rentalObjectCode: `${sequence}`,
    vacantFrom: new Date(),
  })
)
