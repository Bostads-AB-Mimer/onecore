import { Factory } from 'fishery'
import { ApplicantStatus, LeaseStatus, OfferApplicant } from 'onecore-types'

export const OfferApplicantFactory = Factory.define<OfferApplicant>(
  ({ sequence }) => ({
    id: sequence,
    listingId: 1,
    offerId: 1,
    applicantId: 1,
    priority: 1,
    queuePoints: 1,
    status: ApplicantStatus.Active,
    address: 'Testgatan 14',
    applicationType: 'Additional',
    hasParkingSpace: true,
    housingLeaseStatus: LeaseStatus.Current,
    createdAt: new Date(),
    sortOrder: sequence,

    applicationDate: new Date(),
    name: 'Test Testsson',
  })
)
