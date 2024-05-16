import { Factory } from 'fishery'
import { Lease, LeaseStatus, Listing, ListingStatus } from 'onecore-types'
import { leaseTypes } from '../../../constants/leaseTypes'

const LeaseFactory = Factory.define<Lease>(({ sequence }) => ({
  leaseId: `${sequence}`,
  leaseNumber: `0${sequence}`,
  leaseStartDate: new Date(2022, 1),
  leaseEndDate: undefined,
  status: LeaseStatus.Active,
  tenantContactIds: undefined,
  tenants: undefined,
  rentalPropertyId: `605-703-00-0014-${sequence}`,
  rentalProperty: undefined,
  type: leaseTypes.parkingspaceContract,
  rentInfo: undefined,
  address: {
    street: 'Testgatan',
    number: '123',
    postalCode: '723 40',
    city: 'Västerås',
  },
  noticeGivenBy: undefined,
  noticeDate: undefined,
  noticeTimeTenant: undefined,
  preferredMoveOutDate: undefined,
  terminationDate: undefined,
  contractDate: new Date(2021, 11),
  lastDebitDate: undefined,
  approvalDate: new Date(2021, 12),
  residentialArea: {
    code: 'MAL',
    caption: 'Malmaberg',
  },
}))

//todo: use properly defined interface
const ApplicantFactory = Factory.define<any, { currentHousingContract: Lease }>(
  ({ sequence, params }) => ({
    id: `${sequence}`,
    name: 'Test Testsson',
    contactCode: `P${158769 + sequence}`,
    applicationDate: new Date().toISOString(),
    applicationType: 'Additional',
    status: 1,
    listingId: `${sequence}`,
    queuePoints: 10,
    address: {
      street: 'Aromas väg 8B',
      number: '',
      postalCode: '73439',
      city: 'Hallstahammar',
    },
    currentHousingContract: params.currentHousingContract,
    upcomingHousingContract: params.upcomingHousingContract,
    parkingSpaceContracts: [],
    priority: 0,
  })
)

const ListingFactory = Factory.define<Listing>(({ sequence }) => ({
  id: sequence + 1,
  rentalObjectCode: `R${sequence + 1000}`,
  address: 'Sample Address',
  monthlyRent: 1000,
  districtCaption: 'Malmaberg',
  districtCode: 'MAL',
  blockCaption: 'LINDAREN 2',
  blockCode: '1401',
  objectTypeCaption: 'Carport',
  objectTypeCode: 'CPORT',
  rentalObjectTypeCaption: 'Standard hyresobjektstyp',
  rentalObjectTypeCode: 'STD',
  publishedFrom: new Date(),
  publishedTo: new Date(),
  vacantFrom: new Date(),
  status: ListingStatus.Active,
  waitingListType: 'Bilplats (intern)',
  applicants: [],
}))

export { LeaseFactory, ApplicantFactory, ListingFactory }
