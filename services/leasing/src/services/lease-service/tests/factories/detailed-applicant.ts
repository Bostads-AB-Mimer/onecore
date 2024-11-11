import { Factory } from 'fishery'
import { DetailedApplicant } from 'onecore-types'

export const DetailedApplicantFactory = Factory.define<DetailedApplicant>(
  ({ sequence }) => ({
    id: sequence,
    name: 'Test Testsson',
    nationalRegistrationNumber: '199404084924',
    contactCode: `P${158769 + sequence}`,
    applicationDate: new Date(),
    applicationType: 'Additional',
    status: 1,
    listingId: sequence, //maybe keep as undefined?
    queuePoints: 10,
    address: {
      street: 'Aromas väg 8B',
      number: '',
      postalCode: '73439',
      city: 'Hallstahammar',
    },
    currentHousingContract: undefined,
    upcomingHousingContract: undefined,
    parkingSpaceContracts: [],
    priority: null,
  })
)
