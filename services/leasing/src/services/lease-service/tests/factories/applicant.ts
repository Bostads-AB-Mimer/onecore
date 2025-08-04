import { Factory } from 'fishery'
import { Applicant, ApplicantStatus } from 'onecore-types'

export const ApplicantFactory = Factory.define<Applicant>(({ sequence }) => ({
  id: sequence,
  name: 'Test Testsson',
  nationalRegistrationNumber: '199404084924',
  contactCode: `P${158769 + sequence}`,
  applicationDate: new Date(),
  applicationType: 'Additional',
  status: ApplicantStatus.Active,
  listingId: sequence,
}))
